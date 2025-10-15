import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from '../flowable.service';
import {
    CaseCreatedEvent,
    CaseStatusChangedEvent,
    TaskCreatedEvent,
    TaskStatusChangedEvent,
    TaskAssignedEvent,
    CaseAbandonedEvent,
} from '../../events/domain-events';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class FlowableEventListener {
    constructor(
        private readonly flowableService: FlowableService,
        private readonly logger: LoggerService,
    ) {}
    // need to write test for this file
    @OnEvent('case.created')
    async handleCaseCreated(event: CaseCreatedEvent) {
        try {
            const processInstance = await this.flowableService.startProcessInstance(
                'caseManagementProcess',
                {
                    caseId: event.caseId,
                    tenantId: event.tenantId,
                    creationType: event.creationType,
                    creatorRole: event.creatorRole,
                    autocloseEligible: event.autocloseEligible,
                },
                event.caseId,
            );

            this.logger.log(
                `Started Flowable process ${processInstance.id} for case ${event.caseId}`,
                FlowableEventListener.name,
            );
        } catch (error) {
            this.logger.error(
                `Failed to start Flowable process for case ${event.caseId}: ${error.message}`,
                error.stack,
                FlowableEventListener.name,
            );
        }
    }

    @OnEvent('task.created')
    async handleTaskCreated(event: TaskCreatedEvent) {
        try {
            const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                // Only create standalone task if no process exists
                this.logger.warn(
                    `No Flowable process found for case ${event.caseId}, creating standalone task`,
                    FlowableEventListener.name,
                );

                const flowableTask = await this.flowableService.createTask({
                    name: event.taskName,
                    description: event.description,
                    assignee: event.assignedUserId,
                    candidateGroups: [event.candidateGroup],
                    tenantId: processInstance?.tenantId,
                    variables: {
                        postgres_task_id: event.taskId,
                        postgres_case_id: event.caseId,
                        task_status: event.status,
                        task_name: event.taskName,
                        candidate_group: event.candidateGroup,
                    },
                });

                this.logger.log(
                    `Created standalone Flowable task ${flowableTask.id} for PostgreSQL task ${event.taskId}`,
                    FlowableEventListener.name,
                );
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

            let flowableTask = flowableTasks.find((t: any) => {
                const taskVars = t.variables || [];
                const hasPostgresId = taskVars.some((v: any) => v.name === 'postgres_task_id');

                const isMatchingTask = (
                    (t.taskDefinitionKey === this.getTaskDefinitionKey(event.taskName)) ||
                    (t.name === event.taskName && !hasPostgresId)
                );

                return isMatchingTask;
            });

            if (flowableTask) {
                this.logger.log(
                    `Found matching BPMN task ${flowableTask.id} for ${event.taskName}, syncing with PostgreSQL task ${event.taskId}`,
                    FlowableEventListener.name,
                );

                await this.flowableService.syncTaskWithDatabase(flowableTask.id, {
                    postgres_task_id: event.taskId,
                    postgres_case_id: event.caseId,
                    task_status: event.status,
                    assignee_user_id: event.assignedUserId,
                    flowable_case_id: processInstance.id,
                });

                const identityLinks = await this.flowableService.getTaskIdentityLinks(flowableTask.id);
                const hasCandidateGroup = identityLinks.some((link: any) =>
                    link.type === 'candidate' && link.group
                );

                if (!hasCandidateGroup) {
                    await this.flowableService.assignTaskToCandidateGroup(
                        flowableTask.id,
                        event.candidateGroup
                    );
                }

                this.logger.log(
                    `Synced PostgreSQL task ${event.taskId} with existing Flowable BPMN task ${flowableTask.id}`,
                    FlowableEventListener.name,
                );
            } else {
                const shouldCreateNewTask = !this.isBpmnDefinedTask(event.taskName);

                if (shouldCreateNewTask) {
                    this.logger.log(
                        `Creating new Flowable task for non-BPMN task: ${event.taskName}`,
                        FlowableEventListener.name,
                    );

                    flowableTask = await this.flowableService.createTask({
                        name: event.taskName,
                        description: event.description,
                        assignee: event.assignedUserId,
                        candidateGroups: [event.candidateGroup],
                        tenantId: processInstance.tenantId,
                        variables: {
                            postgres_task_id: event.taskId,
                            postgres_case_id: event.caseId,
                            task_status: event.status,
                            task_name: event.taskName,
                            candidate_group: event.candidateGroup,
                            flowable_case_id: processInstance.id,
                        },
                    });

                    this.logger.log(
                        `Created new Flowable task ${flowableTask.id} for PostgreSQL task ${event.taskId}`,
                        FlowableEventListener.name,
                    );
                } else {
                    this.logger.warn(
                        `BPMN task not yet created for ${event.taskName}, will be synced when available`,
                        FlowableEventListener.name,
                    );
                }
            }
        } catch (error) {
            this.logger.error(
                `Failed to sync task ${event.taskId} with Flowable: ${error.message}`,
                error.stack,
                FlowableEventListener.name,
            );
        }
    }

    private getTaskDefinitionKey(taskName: string): string | null {
        const mappings: Record<string, string> = {
            'Approve Case Creation': 'approveCaseCreation',
            'Investigate Case': 'investigateCase',
            'Investigate case': 'investigateCase',
            'Approve case closure': 'supervisorApproval',
            'Triage Alert': '',
            'Complete New Case': '',
        };

        return mappings[taskName] || null;
    }

    private isBpmnDefinedTask(taskName: string): boolean {
        const bpmnTasks = [
            'Approve Case Creation',
            'Investigate Case',
            'Investigate case',
            'Approve case closure',
        ];

        return bpmnTasks.includes(taskName);
    }

    @OnEvent('task.status.changed')
    async handleTaskStatusChanged(event: TaskStatusChangedEvent) {
        try {
            const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                this.logger.warn(
                    `No Flowable process found for case ${event.caseId}`,
                    FlowableEventListener.name,
                );
                return;
            }

            const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

            let flowableTask = flowableTasks.find((t: any) => {
                const taskVars = t.variables || [];
                const postgresIdVar = taskVars.find((v: any) => v.name === 'postgres_task_id');
                return postgresIdVar?.value === event.taskId;
            });

            if (!flowableTask) {
                flowableTask = flowableTasks.find((t: any) => t.name === event.taskName);
            }

            if (flowableTask) {
                await this.flowableService.updateTaskVariable(
                    flowableTask.id,
                    'task_status',
                    event.newStatus,
                );

                if (event.newStatus === TaskStatus.STATUS_30_COMPLETED) {
                    const completionVars = event.completionVariables || {};

                    await this.flowableService.completeTask(
                        flowableTask.id,
                        completionVars,
                    );

                    this.logger.log(
                        `Completed Flowable task ${flowableTask.id} for PostgreSQL task ${event.taskId}`,
                        FlowableEventListener.name,
                    );
                }
            } else {
                this.logger.warn(
                    `Flowable task not found for PostgreSQL task ${event.taskId}`,
                    FlowableEventListener.name,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to update Flowable task status: ${error.message}`,
                error.stack,
                FlowableEventListener.name,
            );
        }
    }

    @OnEvent('task.assigned')
    async handleTaskAssigned(event: TaskAssignedEvent) {
        try {
            const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                return;
            }

            const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);
            const flowableTask = flowableTasks.find((ft: any) => {
                const vars = ft.variables || [];
                const postgresIdVar = vars.find((v: any) => v.name === 'postgres_task_id');
                return postgresIdVar?.value === event.taskId;
            });

            if (flowableTask) {
                await this.flowableService.claimTask(flowableTask.id, event.assignedUserId);
                await this.flowableService.updateTaskVariable(
                    flowableTask.id,
                    'assignee_user_id',
                    event.assignedUserId,
                );

                this.logger.log(
                    `Updated Flowable task ${flowableTask.id} assignment to user ${event.assignedUserId}`,
                    FlowableEventListener.name,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to update Flowable task assignment: ${error.message}`,
                error.stack,
                FlowableEventListener.name,
            );
        }
    }

    @OnEvent('case.status.changed')
    async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
        try {
            const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

            if (!processInstance) {
                return;
            }

            await this.flowableService.setTaskVariables(processInstance.id, {
                case_status: event.newStatus,
                status_change_reason: event.reason || 'Status updated',
            });

            this.logger.log(
                `Updated Flowable process variables for case ${event.caseId}: ${event.oldStatus} -> ${event.newStatus}`,
                FlowableEventListener.name,
            );
        } catch (error) {
            this.logger.error(
                `Failed to update Flowable process status: ${error.message}`,
                error.stack,
                FlowableEventListener.name,
            );
        }
    }

    @OnEvent('case.abandoned')
    async handleCaseAbandoned(event: CaseAbandonedEvent) {
        try {
            const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

            if (processInstance) {
                await this.flowableService.terminateProcessInstance(
                    processInstance.id,
                    `Case abandoned: ${event.reason}`,
                );

                this.logger.log(
                    `Terminated Flowable process for abandoned case ${event.caseId}`,
                    FlowableEventListener.name,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to terminate Flowable process: ${error.message}`,
                error.stack,
                FlowableEventListener.name,
            );
        }
    }
}