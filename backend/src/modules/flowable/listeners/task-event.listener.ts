import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BpmnSyncService } from '../services/bpmn-sync.service';
import { TaskCreatedEvent, TaskStatusChangedEvent, BpmnTaskCreatedEvent, TaskAssignedEvent, TaskUnassignedEvent, TaskCompletedEvent } from '../../events/domain-events';
import { TaskStatus } from '@prisma/client';
import { FlowableUtilitiesService } from '../utils/flowable-utilities.service';
import { FlowableTaskService } from '../services/flowable-task.service';
import { FlowableProcessService } from '../services/flowable-process.service';

/**
 * Listener for task-related domain events
 * Handles task lifecycle events and syncs them with Flowable tasks
 */
@Injectable()
export class TaskEventListener {
    constructor(
        private readonly flowableTaskService: FlowableTaskService,
        private readonly flowableProcessService: FlowableProcessService,
        private readonly logger: LoggerService,
        private readonly bpmnSyncService: BpmnSyncService,
        private readonly utilityService: FlowableUtilitiesService,
    ) { }

    /**
     * Handle task.created event
     * Creates or syncs a Flowable task when a PostgreSQL task is created
     */
    @OnEvent('task.created')
    async handleTaskCreated(event: TaskCreatedEvent) {
        const eventKey = `created-${event.taskId}-${event.taskName}`;

        if (this.utilityService.isDuplicate(eventKey)) {
            this.logger.debug(`Skipping duplicate task.created event for task ${event.taskId}`, TaskEventListener.name);
            return;
        }

        const maxRetries = 3;
        const retryDelayMs = 1000;

        try {
            this.logger.log(
                `[TaskEventListener] Handling task.created for task ${event.taskId} (${event.taskName}) in case ${event.caseId}`,
                TaskEventListener.name,
            );

            let processInstance: any = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

                if (processInstance) {
                    this.logger.log(
                        `[TaskEventListener] Found Flowable process ${processInstance.id} for case ${event.caseId} on attempt ${attempt}`,
                        TaskEventListener.name,
                    );
                    break;
                }

                if (attempt < maxRetries) {
                    this.logger.warn(
                        `[TaskEventListener] Process not found for case ${event.caseId}, retrying (${attempt}/${maxRetries}) in ${retryDelayMs}ms`,
                        TaskEventListener.name,
                    );
                    await this.sleep(retryDelayMs);
                }
            }

            if (!processInstance) {
                this.logger.warn(
                    `[TaskEventListener] No Flowable process found for case ${event.caseId} after ${maxRetries} attempts. Task ${event.taskId} will not be synced to Flowable.`,
                    TaskEventListener.name,
                );
                return;
            }

            const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

            this.logger.log(
                `[TaskEventListener] Found ${flowableTasks.length} Flowable tasks for process ${processInstance.id}`,
                TaskEventListener.name,
            );

            // Check if task already synced
            for (const ft of flowableTasks) {
                const task = ft as Record<string, unknown>;
                const taskVars = await this.utilityService.getTaskVariables(task.id as string);

                this.logger.log(
                    `[TaskEventListener] Checking Flowable task ${task.id} (${task.name}): postgres_task_id=${taskVars.postgres_task_id}`,
                    TaskEventListener.name,
                );

                if (taskVars.postgres_task_id === event.taskId) {
                    this.logger.log(`[TaskEventListener] Task ${event.taskId} already synced to Flowable task ${task.id}`, TaskEventListener.name);
                    return;
                }
            }

            this.logger.log(
                `[TaskEventListener] Task ${event.taskId} not yet synced. Will sync to Flowable.`,
                TaskEventListener.name,
            );

            // Sync the new task
            await this.bpmnSyncService.syncAllTasksForCase(event.caseId, processInstance.id);

            this.logger.log(
                `[TaskEventListener] Successfully synced task ${event.taskId} to Flowable`,
                TaskEventListener.name,
            );
        } catch (error) {
            this.logger.error(
                `[TaskEventListener] Failed to sync task ${event.taskId} to Flowable: ${error.message}`,
                error.stack,
                TaskEventListener.name,
            );
        }
    }

    /**
     * Handle task.status.changed event
     * Updates or completes the Flowable task based on status change
     */
    @OnEvent('task.status.changed')
    async handleTaskStatusChanged(event: TaskStatusChangedEvent) {
        const eventKey = `status-${event.taskId}-${event.newStatus}`;

        if (this.utilityService.isDuplicate(eventKey)) {
            this.logger.debug(`Skipping duplicate task.status.changed event for task ${event.taskId}`, TaskEventListener.name);
            return;
        }

        try {
            this.logger.log(
                `[TaskEventListener] Task status changed - Task: ${event.taskId}, Name: "${event.taskName}", Status: ${event.oldStatus} -> ${event.newStatus}`,
                TaskEventListener.name,
            );

            if (event.completionVariables) {
                this.logger.log(
                    `[TaskEventListener] Completion variables: ${JSON.stringify(event.completionVariables)}`,
                    TaskEventListener.name,
                );
            }

            const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                this.logger.warn(`[TaskEventListener] No Flowable process found for case ${event.caseId}`, TaskEventListener.name);
                return;
            }

            this.logger.log(`[TaskEventListener] Found process instance: ${processInstance.id}`, TaskEventListener.name);

            const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

            this.logger.log(`[TaskEventListener] Found ${flowableTasks.length} Flowable tasks in process`, TaskEventListener.name);

            let flowableTask: any = null;

            for (const t of flowableTasks) {
                const task = t as Record<string, unknown>;
                const taskVars = await this.utilityService.getTaskVariables(task.id as string);

                this.logger.log(
                    `[TaskEventListener] Checking Flowable task ${task.id} (${task.name}) - postgres_task_id: ${taskVars.postgres_task_id}`,
                    TaskEventListener.name,
                );

                if (taskVars.postgres_task_id === event.taskId) {
                    flowableTask = task;
                    this.logger.log(`[TaskEventListener] Found matching Flowable task ${task.id}`, TaskEventListener.name);
                    break;
                }
            }

            if (!flowableTask) {
                this.logger.warn(`[TaskEventListener] Flowable task not found for PostgreSQL task ${event.taskId}`, TaskEventListener.name);
                return;
            }

            const taskObj = flowableTask as Record<string, unknown>;

            // If task is being completed OR has completion variables, complete it in Flowable
            if (event.newStatus === TaskStatus.STATUS_30_COMPLETED || event.completionVariables) {
                this.logger.log(`[TaskEventListener] Task completion requested for Flowable task ${taskObj.id}`, TaskEventListener.name);

                const completionVars: Record<string, string> = {
                    task_completed: 'true',
                    completed_at: new Date().toISOString(),
                    completed_by: event.assignedUserId || 'SYSTEM',
                };

                // Add completion variables if provided
                if (event.completionVariables) {
                    Object.entries(event.completionVariables).forEach(([key, value]) => {
                        completionVars[key] = String(value);
                    });
                }

                this.logger.log(
                    `[TaskEventListener] Completing Flowable task ${taskObj.id} with variables: ${JSON.stringify(completionVars)}`,
                    TaskEventListener.name,
                );

                try {
                    await this.flowableTaskService.completeTask(taskObj.id as string, completionVars);

                    this.logger.log(
                        `[TaskEventListener] Successfully completed Flowable task ${taskObj.id}. BPMN should now progress.`,
                        TaskEventListener.name,
                    );

                    // Sync BPMN tasks after completion
                    setTimeout(async () => {
                        try {
                            this.logger.log(`[TaskEventListener] Starting BPMN task sync for case ${event.caseId}...`, TaskEventListener.name);

                            const updatedProcessInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

                            if (!updatedProcessInstance) {
                                this.logger.warn(
                                    `[TaskEventListener] Process instance no longer exists for case ${event.caseId}. It may have ended.`,
                                    TaskEventListener.name,
                                );
                                return;
                            }

                            this.logger.log(
                                `[TaskEventListener] Process instance still active: ${updatedProcessInstance.id}`,
                                TaskEventListener.name,
                            );

                            await this.bpmnSyncService.syncAllTasksForCase(event.caseId, processInstance.id as string);

                            this.logger.log(`[TaskEventListener] BPMN task sync completed for case ${event.caseId}`, TaskEventListener.name);
                        } catch (syncError) {
                            this.logger.error(
                                `[TaskEventListener] Failed to sync BPMN tasks: ${syncError.message}`,
                                syncError.stack,
                                TaskEventListener.name,
                            );
                        }
                    }, 3000);
                } catch (completeError) {
                    if (completeError.response?.status === 404) {
                        this.logger.warn(
                            `[TaskEventListener] Flowable task ${taskObj.id} not found (404) - may be already completed`,
                            TaskEventListener.name,
                        );
                    } else if (completeError.response?.status === 409) {
                        this.logger.warn(
                            `[TaskEventListener] Flowable task ${taskObj.id} conflict (409) - may be already completed`,
                            TaskEventListener.name,
                        );
                    } else {
                        this.logger.error(
                            `[TaskEventListener] Failed to complete Flowable task ${taskObj.id}: ${completeError.message}`,
                            completeError.stack,
                            TaskEventListener.name,
                        );

                        if (completeError.response) {
                            this.logger.error(
                                `[TaskEventListener] Error response: ${JSON.stringify(completeError.response.data)}`,
                                TaskEventListener.name,
                            );
                        }
                    }
                }
            } else {
                this.logger.log(
                    `[TaskEventListener] Updating Flowable task ${taskObj.id} status variable to ${event.newStatus}`,
                    TaskEventListener.name,
                );

                await this.flowableTaskService.updateTaskVariable(taskObj.id as string, 'task_status', event.newStatus);

                this.logger.log(`[TaskEventListener] Updated Flowable task ${taskObj.id} status variable`, TaskEventListener.name);
            }
        } catch (error) {
            this.logger.error(`[TaskEventListener] CRITICAL ERROR: ${error.message}`, error.stack, TaskEventListener.name);
        }
    }

    /**
     * Handle task.completed event
     * Completes the corresponding Flowable task
     */
    @OnEvent('task.completed')
    async handleTaskCompleted(event: TaskCompletedEvent) {
        const eventKey = `completed-${event.taskId}`;

        if (this.utilityService.isDuplicate(eventKey)) {
            this.logger.debug(`Skipping duplicate task.completed event for task ${event.taskId}`, TaskEventListener.name);
            return;
        }

        try {
            if (event.newStatus !== TaskStatus.STATUS_30_COMPLETED) {
                return;
            }

            const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
            }

            const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

            const flowableTask = flowableTasks.find((t: unknown) => {
                const task = t as Record<string, unknown>;
                const taskVars = (task.variables as unknown[]) || [];
                const postgresIdVar = taskVars.find((v: unknown) => {
                    const variable = v as Record<string, unknown>;
                    return variable.name === 'postgres_task_id';
                }) as Record<string, unknown> | undefined;
                return postgresIdVar?.value === event.taskId;
            });

            if (!flowableTask) {
                throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
            }

            const taskObj = flowableTask as Record<string, unknown>;

            const completionVars: Record<string, string> = {
                investigationAction: 'complete',
                task_completed: 'true',
                completed_at: new Date().toISOString(),
            };

            if (event.completionVariables) {
                Object.entries(event.completionVariables).forEach(([key, value]) => {
                    completionVars[key] = String(value);
                });
            }

            this.logger.log(
                `[TaskEventListener] Completing Flowable task ${taskObj.id} with variables: ${JSON.stringify(completionVars)}`,
                TaskEventListener.name,
            );

            await this.flowableTaskService.completeTask(taskObj.id as string, completionVars);

            this.logger.log(
                `[TaskEventListener] ✓ Completed Flowable task ${taskObj.id} for PostgreSQL task ${event.taskId}`,
                TaskEventListener.name,
            );
        } catch (error) {
            this.logger.error(`[TaskEventListener] ✗ Failed to complete Flowable task: ${error.message}`, error.stack, TaskEventListener.name);
        }
    }

    /**
     * Handle bpmn.task.created event
     * Creates a PostgreSQL task for a BPMN task and syncs them
     */
    @OnEvent('bpmn.task.created')
    async handleBpmnTaskCreated(event: BpmnTaskCreatedEvent) {
        try {
            this.logger.log(
                `[TaskEventListener] Creating PostgreSQL task for BPMN task ${event.flowableTaskId} (${event.taskName})`,
                TaskEventListener.name,
            );

            const postgresTask = await this.utilityService.createTask(
                {
                    caseId: event.caseId,
                    status: TaskStatus.STATUS_01_UNASSIGNED,
                    name: event.taskName,
                    description: event.description,
                    candidateGroup: event.candidateGroup,
                },
                'system'
            )

            const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

            await this.flowableTaskService.setTaskVariables(event.flowableTaskId, {
                postgres_task_id: postgresTask.task_id,
                postgres_case_id: event.caseId,
                task_status: TaskStatus.STATUS_01_UNASSIGNED,
                task_name: event.taskName,
                candidate_group: event.candidateGroup,
                flowable_case_id: (processInstance?.id as string) || '',
            });

            this.logger.log(
                `[TaskEventListener] ✓ Created and synced PostgreSQL task ${postgresTask.task_id} with BPMN task ${event.flowableTaskId}`,
                TaskEventListener.name,
            );
        } catch (error) {
            this.logger.error(
                `[TaskEventListener] ✗ Failed to create PostgreSQL task: ${error.message}`,
                error.stack,
                TaskEventListener.name,
            );
        }
    }

    @OnEvent('task.assigned')
    async handleTaskAssigned(event: TaskAssignedEvent) {
        const eventKey = `assigned-${event.taskId}-${event.assignedUserId}`;

        if (this.utilityService.isDuplicate(eventKey)) {
            this.logger.debug(`Skipping duplicate task.assigned event for task ${event.taskId}`, TaskEventListener.name);
            return;
        }

        try {
            const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
            }

            const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

            const flowableTask = flowableTasks.find((ft: unknown) => {
                const task = ft as Record<string, unknown>;
                const vars = (task.variables as unknown[]) || [];
                const postgresIdVar = vars.find((v: unknown) => {
                    const variable = v as Record<string, unknown>;
                    return variable.name === 'postgres_task_id';
                }) as Record<string, unknown> | undefined;
                return postgresIdVar?.value === event.taskId;
            });

            if (!flowableTask) {
                throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
            }

            const taskObj = flowableTask as Record<string, unknown>;
            await this.flowableTaskService.claimTask(taskObj.id as string, event.assignedUserId);

            const variablesToUpdate = {
                assignee_user_id: event.assignedUserId,
                task_status: 'STATUS_10_ASSIGNED',
                reassigned_from: event.previousAssignedUserId || '',
                reassigned_at: new Date().toISOString(),
            };

            await this.flowableTaskService.setTaskVariables(taskObj.id as string, variablesToUpdate);

            this.logger.log(`Successfully assigned Flowable task ${taskObj.id} to user ${event.assignedUserId}`, TaskEventListener.name);
        } catch (error) {
            this.logger.error(`Failed to assign Flowable task: ${error.message}`, error.stack, TaskEventListener.name);
        }
    }

    @OnEvent('task.unassigned')
    async handleTaskUnassigned(event: TaskUnassignedEvent) {
        const eventKey = `unassigned-${event.taskId}`;

        if (this.utilityService.isDuplicate(eventKey)) {
            this.logger.debug(`Skipping duplicate task.unassigned event for task ${event.taskId}`, TaskEventListener.name);
            return;
        }

        try {
            const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
            }

            const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

            const flowableTask = flowableTasks.find((ft: unknown) => {
                const task = ft as Record<string, unknown>;
                const vars = (task.variables as unknown[]) || [];
                const postgresIdVar = vars.find((v: unknown) => {
                    const variable = v as Record<string, unknown>;
                    return variable.name === 'postgres_task_id';
                }) as Record<string, unknown> | undefined;
                return postgresIdVar?.value === event.taskId;
            });

            if (!flowableTask) {
                throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
            }

            const taskObj = flowableTask as Record<string, unknown>;
            await this.flowableTaskService.unclaimTask(taskObj.id as string);

            const variablesToUpdate = {
                assignee_user_id: '',
                task_status: 'STATUS_01_UNASSIGNED',
                unassigned_from: event.previousAssignedUserId || '',
                unassigned_at: new Date().toISOString(),
                unassignment_reason: event.reason || 'Task unassigned',
            };

            await this.flowableTaskService.setTaskVariables(taskObj.id as string, variablesToUpdate);

            if (event.candidateGroup) {
                await this.flowableTaskService.assignTaskToCandidateGroup(taskObj.id as string, event.candidateGroup);
            }

            this.logger.log(`Unassigned Flowable task ${taskObj.id} from user ${event.previousAssignedUserId}`, TaskEventListener.name);
        } catch (error) {
            this.logger.error(`Failed to unassign Flowable task: ${error.message}`, error.stack, TaskEventListener.name);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
