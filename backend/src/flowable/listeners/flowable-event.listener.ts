import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from '../flowable.service';
import { TaskService } from '../../task/task.service';

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
  ) {}

  @OnEvent('case.created')
  async handleCaseCreated(event: CaseCreatedEvent) {
    try {
      this.logger.log(
          `[Flowable-CaseCreated] Starting process for case ${event.caseId} with status ${event.caseStatus}`,
          FlowableEventListener.name,
      );

      const processInstance = await this.flowableService.startProcessInstance(
          'caseManagementProcess',
          {
            caseId: event.caseId,
            tenantId: event.tenantId,
            creationType: event.creationType,
            caseStatus: event.caseStatus,
            autocloseEligible: String(event.autocloseEligible),
          },
          event.caseId,
      );

      this.logger.log(
          `[Flowable-CaseCreated] Successfully started process ${processInstance.id} for case ${event.caseId}`,
          FlowableEventListener.name,
      );
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
    const retryDelayMs = 1000; // 1 second between retries

    try {
      this.logger.log(
          `Handling task.created for task ${event.taskId} (${event.taskName}) in case ${event.caseId}`,
          FlowableEventListener.name,
      );

      let processInstance: any = null;
      
      // Retry logic to handle race condition between case creation and task creation
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

      // Check if task already exists (prevent duplicates)
      const existingTask = flowableTasks.find((t: unknown) => {
        const task = t as Record<string, unknown>;
        const taskVars = (task.variables as unknown[]) || [];

        // Check by postgres_task_id first (most reliable)
        const hasMatchingPostgresId = taskVars.some((v: unknown) => {
          const variable = v as Record<string, unknown>;
          return variable.name === 'postgres_task_id' && variable.value === event.taskId;
        });

        // If no postgres_task_id, check by task name
        const hasMatchingName = task.name === event.taskName && !taskVars.some((v: unknown) =>{
          const variable = v as Record<string, unknown>;
          return variable.name === 'postgres_task_id';
        });

        return hasMatchingPostgresId || hasMatchingName;
      });

      if (existingTask) {
        const taskObj = existingTask as Record<string, unknown>;
        this.logger.error(
            `Task "${event.taskName}" already exists in process ${processInstance.id}. Cannot create duplicate task.`,
            FlowableEventListener.name,
        );
        throw new Error(
            `Task "${event.taskName}" already exists in process ${processInstance.id}. Duplicate task creation prevented.`
        );
      }

      // Create the task in Flowable
      const flowableTask = await this.flowableService.createTask({
        name: event.taskName,
        description: event.description,
        candidateGroups: event.candidateGroup ? [event.candidateGroup] : undefined,
        assignee: event.assignedUserId,
        variables: {
          postgres_task_id: event.taskId,
          postgres_case_id: event.caseId,
          task_status: event.status,
          assignee_user_id: event.assignedUserId || '',
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
      
      // This is critical - task exists in DB but not in Flowable, breaking work queue sync
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

      this.logger.log(
          `Updated Flowable task ${taskObj.id} status to ${event.newStatus}`,
          FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
          `Failed to update Flowable task status: ${error.message}`,
          error.stack,
          FlowableEventListener.name,
      );
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

      this.logger.log(
          `Completed Flowable task ${taskObj.id} for PostgreSQL task ${event.taskId}`,
          FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
          `Failed to complete Flowable task: ${error.message}`,
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

      this.logger.log(
          `Successfully assigned Flowable task ${taskObj.id} to user ${event.assignedUserId}`,
          FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
          `Failed to assign Flowable task: ${error.message}`,
          error.stack,
          FlowableEventListener.name,
      );
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

      this.logger.log(
          `Unassigned Flowable task ${taskObj.id} from user ${event.previousAssignedUserId}`,
          FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
          `Failed to unassign Flowable task: ${error.message}`,
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
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const processVariables = {
        case_status: event.newStatus,
        status_change_reason: event.reason || 'Status updated',
        status_changed_at: new Date().toISOString(),
        previous_status: event.oldStatus,
      };

      await this.flowableService.setProcessVariables(processInstance.id as string, processVariables);

      this.logger.log(
          `Updated Flowable process ${processInstance.id} status for case ${event.caseId}`,
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
      this.logger.error(
          `Failed to create PostgreSQL task: ${error.message}`,
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
            processInstance.id as string,
            `Case abandoned: ${event.reason}`,
        );
        this.logger.log(`Terminated Flowable process for abandoned case ${event.caseId}`, FlowableEventListener.name);
      }
    } catch (error) {
      this.logger.error(
          `Failed to terminate Flowable process: ${error.message}`,
          error.stack,
          FlowableEventListener.name,
      );
    }
  }

  /**
   * Utility method to sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}