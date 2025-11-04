import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from '../flowable.service';
import { TaskService } from '../../task/task.service';
import { PrismaService } from '../../../prisma/prisma.service';

import {
  CaseCreatedEvent,
  CaseStatusChangedEvent,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  CaseAbandonedEvent,
  TaskUnassignedEvent,
  BpmnTaskCreatedEvent,
} from '../../events/domain-events';
import { TaskStatus } from '@prisma/client';
import { AuditLogService } from '../../audit/auditLog.service';

@Injectable()
export class FlowableEventListener {
  constructor(
    private readonly flowableService: FlowableService,
    private readonly logger: LoggerService,
    private readonly taskService: TaskService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
  ) {}

  @OnEvent('case.created')
  async handleCaseCreated(event: CaseCreatedEvent) {
    try {
      this.logger.log(
        `[Flowable-CaseCreated] Starting process for case ${event.caseId} with status ${event.caseStatus}`,
        FlowableEventListener.name,
      );

      const creatorRole = event.creationType === 'MANUAL' ? 'SUPERVISOR' : 'SYSTEM';

      const processInstance = await this.flowableService.startProcessInstance(
        'caseManagementProcess',
        {
          caseId: event.caseId,
          tenantId: event.tenantId,
          creationType: event.creationType,
          caseStatus: event.caseStatus,
          autocloseEligible: String(event.autocloseEligible),
          creatorRole: creatorRole,
        },
        event.caseId,
      );

      this.logger.log(
        `[Flowable-CaseCreated] Successfully started process ${processInstance.id} for case ${event.caseId}`,
        FlowableEventListener.name,
      );

      setTimeout(async () => {
        try {
          await this.syncBpmnCreatedTasksForCase(event.caseId, processInstance.id);
          this.logger.log(`[Flowable-CaseCreated] BPMN task sync completed for case ${event.caseId}`, FlowableEventListener.name);
        } catch (syncError) {
          this.logger.error(
            `[Flowable-CaseCreated] BPMN task sync failed for case ${event.caseId}: ${syncError.message}`,
            syncError.stack,
            FlowableEventListener.name,
          );
        }
      }, 2000);
    } catch (error) {
      this.logger.error(
        `[Flowable-CaseCreated] Failed to start process for case ${event.caseId}: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );
    }
  }

  @OnEvent('task.created')
  async handleTaskCreated(event: TaskCreatedEvent) {
    const maxRetries = 3;
    const retryDelayMs = 1000;

    try {
      this.logger.log(
        `Handling task.created for task ${event.taskId} (${event.taskName}) in case ${event.caseId}`,
        FlowableEventListener.name,
      );

      let processInstance: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

        if (processInstance) {
          this.logger.log(
            `Found Flowable process ${processInstance.id} for case ${event.caseId} on attempt ${attempt}`,
            FlowableEventListener.name,
          );
          break;
        }

        if (attempt < maxRetries) {
          this.logger.warn(
            `Process not found for case ${event.caseId}, retrying (${attempt}/${maxRetries}) in ${retryDelayMs}ms`,
            FlowableEventListener.name,
          );
          await this.sleep(retryDelayMs);
        }
      }

      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId} after ${maxRetries} attempts`);
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

      
      const existingTask = flowableTasks.find((t: unknown) => {
        const task = t as Record<string, unknown>;
        const taskVars = (task.variables as unknown[]) || [];

        const hasMatchingPostgresId = taskVars.some((v: unknown) => {
          const variable = v as Record<string, unknown>;
          return variable.name === 'postgres_task_id' && variable.value === event.taskId;
        });

        const hasMatchingName =
          task.name === event.taskName &&
          !taskVars.some((v: unknown) => {
            const variable = v as Record<string, unknown>;
            return variable.name === 'postgres_task_id';
          });

        return hasMatchingPostgresId || hasMatchingName;
      });

      if (existingTask) {
        const taskObj = existingTask as Record<string, unknown>;

        const taskVars = (taskObj.variables as unknown[]) || [];
        const hasPostgresId = taskVars.some((v: unknown) => {
          const variable = v as Record<string, unknown>;
          return variable.name === 'postgres_task_id';
        });

        if (!hasPostgresId) {
          this.logger.log(
            `Found existing BPMN task "${event.taskName}" (${taskObj.id}) that needs syncing with database task ${event.taskId}`,
            FlowableEventListener.name,
          );

          await this.flowableService.setTaskVariables(taskObj.id as string, {
            postgres_task_id: event.taskId,
            task_status: event.status,
            flowable_case_id: processInstance.id as string,
            task_name: event.taskName,
          });

          this.logger.log(
            ` Database ↔ Flowable SYNC SUCCESS: Synced existing Flowable task ${taskObj.id} with PostgreSQL task ${event.taskId} (${event.taskName}) in case ${event.caseId}`,
            FlowableEventListener.name,
          );
          return;
        } else {
          this.logger.error(
            `Task "${event.taskName}" already exists in process ${processInstance.id} and is already synced. Cannot create duplicate task.`,
            FlowableEventListener.name,
          );
          throw new Error(`Task "${event.taskName}" already exists in process ${processInstance.id}. Duplicate task creation prevented.`);
        }
      }

      
      const flowableTask = await this.flowableService.createTask({
        name: event.taskName,
        description: event.description,
        candidateGroups: event.candidateGroup ? [event.candidateGroup] : undefined,
        assignee: event.assignedUserId,
        variables: {
          postgres_task_id: event.taskId,
          task_status: event.status,
          flowable_case_id: processInstance.id as string,
          task_name: event.taskName,
        },
      });

      this.logger.log(
        ` Database ↔ Flowable SYNC SUCCESS: Created Flowable task ${flowableTask.id} for PostgreSQL task ${event.taskId} (${event.taskName}) in case ${event.caseId}`,
        FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
        ` Database ↔ Flowable SYNC FAILED: Failed to create Flowable task for PostgreSQL task ${event.taskId} (${event.taskName}) in case ${event.caseId}: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );

      throw error;
    }
  }

  @OnEvent('task.status.changed')
  async handleTaskStatusChanged(event: TaskStatusChangedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

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
      await this.flowableService.updateTaskVariable(taskObj.id as string, 'task_status', event.newStatus);

      this.logger.log(`Updated Flowable task ${taskObj.id} status to ${event.newStatus}`, FlowableEventListener.name);
    } catch (error) {
      this.logger.error(`Failed to update Flowable task status: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('task.completed')
  async handleTaskCompleted(event: TaskStatusChangedEvent) {
    try {
      if (event.newStatus !== TaskStatus.STATUS_30_COMPLETED) {
        return;
      }

      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

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

      const completionVars: Record<string, string> = {};
      if (event.completionVariables) {
        Object.entries(event.completionVariables).forEach(([key, value]) => {
          completionVars[key] = String(value);
        });
      }

      await this.flowableService.completeTask(taskObj.id as string, completionVars);

      this.logger.log(`Completed Flowable task ${taskObj.id} for PostgreSQL task ${event.taskId}`, FlowableEventListener.name);
    } catch (error) {
      this.logger.error(`Failed to complete Flowable task: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('task.assigned')
  async handleTaskAssigned(event: TaskAssignedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

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
      await this.flowableService.claimTask(taskObj.id as string, event.assignedUserId);

      const variablesToUpdate = {
        assignee_user_id: event.assignedUserId,
        task_status: 'STATUS_10_ASSIGNED',
        reassigned_from: event.previousAssignedUserId || '',
        reassigned_at: new Date().toISOString(),
      };

      await this.flowableService.setTaskVariables(taskObj.id as string, variablesToUpdate);

      this.logger.log(`Successfully assigned Flowable task ${taskObj.id} to user ${event.assignedUserId}`, FlowableEventListener.name);
    } catch (error) {
      this.logger.error(`Failed to assign Flowable task: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('task.unassigned')
  async handleTaskUnassigned(event: TaskUnassignedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

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
      await this.flowableService.unclaimTask(taskObj.id as string);

      const variablesToUpdate = {
        assignee_user_id: '',
        task_status: 'STATUS_01_UNASSIGNED',
        unassigned_from: event.previousAssignedUserId || '',
        unassigned_at: new Date().toISOString(),
        unassignment_reason: event.reason || 'Task unassigned',
      };

      await this.flowableService.setTaskVariables(taskObj.id as string, variablesToUpdate);

      if (event.candidateGroup) {
        await this.flowableService.assignTaskToCandidateGroup(taskObj.id as string, event.candidateGroup);
      }

      this.logger.log(`Unassigned Flowable task ${taskObj.id} from user ${event.previousAssignedUserId}`, FlowableEventListener.name);
    } catch (error) {
      this.logger.error(`Failed to unassign Flowable task: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('case.status.changed')
  async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const processVariables = {
        case_status: event.newStatus,
        status_change_reason: event.reason || 'Status updated',
        status_changed_at: new Date().toISOString(),
        previous_status: event.oldStatus,
      };

      await this.flowableService.setProcessVariables(processInstance.id as string, processVariables);

      this.logger.log(`Updated Flowable process ${processInstance.id} status for case ${event.caseId}`, FlowableEventListener.name);
    } catch (error) {
      this.logger.error(`Failed to update Flowable process status: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('bpmn.task.created')
  async handleBpmnTaskCreated(event: BpmnTaskCreatedEvent) {
    try {
      const postgresTask = await this.taskService.createTask(
        {
          caseId: event.caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: event.taskName,
          description: event.description,
          candidateGroup: event.candidateGroup,
        },
        'system',
        this.auditLogService,
        this.logger,
      );

      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      await this.flowableService.setTaskVariables(event.flowableTaskId, {
        postgres_task_id: postgresTask.task_id,
        postgres_case_id: event.caseId,
        task_status: TaskStatus.STATUS_01_UNASSIGNED,
        task_name: event.taskName,
        candidate_group: event.candidateGroup,
        flowable_case_id: (processInstance?.id as string) || '',
      });

      this.logger.log(
        `Created and synced PostgreSQL task ${postgresTask.task_id} with BPMN task ${event.flowableTaskId}`,
        FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(`Failed to create PostgreSQL task: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('case.abandoned')
  async handleCaseAbandoned(event: CaseAbandonedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (processInstance) {
        await this.flowableService.terminateProcessInstance(processInstance.id as string, `Case abandoned: ${event.reason}`);
        this.logger.log(`Terminated Flowable process for abandoned case ${event.caseId}`, FlowableEventListener.name);
      }
    } catch (error) {
      this.logger.error(`Failed to terminate Flowable process: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  private async syncBpmnCreatedTasksForCase(caseId: string, processInstanceId: string): Promise<void> {
    try {
      const flowableTasks = await this.flowableService.getProcessTasks(processInstanceId);

      this.logger.log(`[BPMN-Sync] Found ${flowableTasks.length} Flowable tasks for case ${caseId}`, FlowableEventListener.name);

      for (const flowableTask of flowableTasks) {
        await this.syncSingleBpmnTask(flowableTask, caseId);
      }

      this.logger.log(`[BPMN-Sync] Completed sync for all tasks in case ${caseId}`, FlowableEventListener.name);
    } catch (error) {
      this.logger.error(
        `[BPMN-Sync] Failed to sync BPMN tasks for case ${caseId}: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );
      throw error;
    }
  }

  private async syncSingleBpmnTask(flowableTask: any, caseId: string): Promise<void> {
    const taskId = flowableTask.id;

    try {
      const taskVariables = await this.flowableService.getTaskVariables(taskId);

      if (taskVariables.postgres_task_id) {
        const dbTask = await this.prismaService.task.findUnique({
          where: { task_id: taskVariables.postgres_task_id },
        });

        if (dbTask) {
          this.logger.debug(`[BPMN-Sync] Task ${taskId} already synced with database task ${dbTask.task_id}`, FlowableEventListener.name);
          return;
        } else {
          this.logger.warn(
            `[BPMN-Sync] Flowable task ${taskId} references non-existent database task ${taskVariables.postgres_task_id}`,
            FlowableEventListener.name,
          );
        }
      }

      const dbCase = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
      });

      if (!dbCase) {
        this.logger.error(`[BPMN-Sync] Database case ${caseId} not found for Flowable task ${taskId}`, FlowableEventListener.name);
        return;
      }

      const candidateGroup = this.determineCandidateGroupFromTask(flowableTask);
      const taskStatus = flowableTask.assignee ? TaskStatus.STATUS_10_ASSIGNED : TaskStatus.STATUS_01_UNASSIGNED;

      const dbTask = await this.taskService.createTask(
        {
          caseId,
          status: taskStatus,
          name: flowableTask.name,
          description: flowableTask.description || `Task created from BPMN process: ${flowableTask.name}`,
          candidateGroup,
          assignedUserId: flowableTask.assignee,
        },
        'system',
        this.auditLogService,
        this.logger,
      );

      const variables = {
        postgres_task_id: dbTask.task_id,
        postgres_case_id: caseId,
        task_status: dbTask.status,
        task_name: flowableTask.name,
        candidate_group: dbTask.candidateGroup || '',
      };

      await this.flowableService.setTaskVariables(taskId, variables);

      this.logger.log(
        `[BPMN-Sync]  Successfully synced Flowable task ${taskId} with database task ${dbTask.task_id} for case ${caseId}`,
        FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(`[BPMN-Sync] Failed to sync Flowable task ${taskId}: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  private determineCandidateGroupFromTask(flowableTask: any): string {
    if (flowableTask.candidateGroups && flowableTask.candidateGroups.length > 0) {
      const group = flowableTask.candidateGroups[0].toLowerCase();
      if (['supervisors', 'investigations', 'investigator'].includes(group)) {
        return group;
      }
    }

    const taskName = flowableTask.name.toLowerCase();

    if (taskName.includes('approve') || taskName.includes('supervisor')) {
      return 'supervisors';
    } else if (taskName.includes('investigate') || taskName.includes('investigation')) {
      return 'investigations';
    } else {
      return 'investigations';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
