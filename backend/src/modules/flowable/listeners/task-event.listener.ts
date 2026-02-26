import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BpmnSyncService } from '../services/bpmn-sync.service';
import {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  BpmnTaskCreatedEvent,
  TaskAssignedEvent,
  TaskUnassignedEvent,
  TaskCompletedEvent,
} from '../../events/domain-events';
import { TaskStatus } from '@prisma/client-cms';
import { FlowableUtilitiesService } from '../services/flowable-utilities.service';
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
  ) {}

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

        // if (attempt < maxRetries) {
        //   this.logger.warn(
        //     `[TaskEventListener] Process not found for case ${event.caseId}, retrying (${attempt}/${maxRetries}) in ${retryDelayMs}ms`,
        //     TaskEventListener.name,
        //   );
        //   await this.sleep(retryDelayMs);
        // }
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
        const taskVars = await this.utilityService.getTaskVariables(task.id as number);

        this.logger.log(
          `[TaskEventListener] Checking Flowable task ${task.id} (${task.name}): postgres_task_id=${taskVars.postgres_task_id}`,
          TaskEventListener.name,
        );

        if (taskVars.postgres_task_id === event.taskId) {
          this.logger.log(`[TaskEventListener] Task ${event.taskId} already synced to Flowable task ${task.id}`, TaskEventListener.name);
          return;
        }
      }

      this.logger.log(`[TaskEventListener] Task ${event.taskId} not yet synced. Will sync to Flowable.`, TaskEventListener.name);

      // Sync the new task
      await this.bpmnSyncService.syncAllTasksForCase(event.caseId, processInstance.id);

      this.logger.log(`[TaskEventListener] Successfully synced task ${event.taskId} to Flowable`, TaskEventListener.name);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle task.status.changed event
   * Updates or completes the Flowable task based on status change
   */
  @OnEvent('task.status.changed')
  async handleTaskStatusChanged(event: TaskStatusChangedEvent) {
    this.logger.log(`Start - Handle task.status.changed for task ${event.taskId}`, TaskEventListener.name);
    // const eventKey = `status-${event.taskId}-${event.newStatus}`;

    // if (this.utilityService.isDuplicate(eventKey)) {
    //   this.logger.debug(`Skipping duplicate task.status.changed event for task ${event.taskId}`, TaskEventListener.name);
    //   return;
    // }

    try {
      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn('No Flowable Process Found', TaskEventListener.name);
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      this.logger.log(`[TaskEventListener] Found process instance: ${processInstance.id}`, TaskEventListener.name);

      const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

      let flowableTask: unknown = null;

      for (const t of flowableTasks) {
        const task = t as Record<string, unknown>;
        const taskVars = await this.utilityService.getTaskVariables(task.id as number);

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
          await this.flowableTaskService.completeTask(taskObj.id as number, completionVars);

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

              this.logger.log(`[TaskEventListener] Process instance still active: ${updatedProcessInstance.id}`, TaskEventListener.name);

              await this.bpmnSyncService.syncAllTasksForCase(event.caseId, processInstance.id as string);

              this.logger.log(`[TaskEventListener] BPMN task sync completed for case ${event.caseId}`, TaskEventListener.name);
            } catch (syncError) {
              const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
              const errorStack = syncError instanceof Error ? syncError.stack : undefined;
              this.logger.error(`[TaskEventListener] Failed to sync BPMN tasks: ${errorMessage}`, errorStack, TaskEventListener.name);
            }
          }, 3000);
        } catch (completeError) {
          throw completeError;
        }
      } else {
        this.logger.log(
          `[TaskEventListener] Updating Flowable task ${taskObj.id} status variable to ${event.newStatus}`,
          TaskEventListener.name,
        );

        await this.flowableTaskService.updateTaskVariable(taskObj.id as number, 'task_status', event.newStatus);

        this.logger.log(`[TaskEventListener] Updated Flowable task ${taskObj.id} status variable`, TaskEventListener.name);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle task.completed event
   * Completes the corresponding Flowable task
   */
  @OnEvent('task.completed')
  async handleTaskCompleted(event: TaskCompletedEvent) {
    try {
      if (event.newStatus !== TaskStatus.STATUS_30_COMPLETED) {
        return;
      }

      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);
      const task = flowableTasks.find(
        (task: { name: string; processInstanceId: string }) =>
          task.name === event.taskName && task.processInstanceId === processInstance.id,
      );

      const completionVars: Record<string, string> = {};
      if (event.completionVariables) {
        Object.entries(event.completionVariables).forEach(([key, value]) => {
          completionVars[key] = String(value);
        });
      }

      await this.flowableTaskService.completeTask(task.id, completionVars);

      this.logger.log(`Completed Flowable task ${task.id}`, TaskEventListener.name);
    } catch (error) {
      throw error;
    }
  }

  @OnEvent('task.assigned')
  async handleTaskAssigned(event: TaskAssignedEvent) {
    try {
      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

      const task = flowableTasks.find(
        (task: { name: string; processInstanceId: string }) =>
          task.name === event.taskName && task.processInstanceId === processInstance.id,
      );

      if (!task) {
        throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
      }

      await this.flowableTaskService.claimTask(task.id as number, event.assignedUserId);

      // const variablesToUpdate = {
      //   assignedUserId: event.assignedUserId,
      //   taskStatus: 'STATUS_10_ASSIGNED',
      // };

      // await this.flowableTaskService.setTaskVariables(task.id as string, variablesToUpdate);

      this.logger.log(`Successfully assigned Flowable task ${task.id} to user ${event.assignedUserId}`, TaskEventListener.name);
    } catch (error) {
      throw error;
    }
  }

  @OnEvent('task.unassigned')
  async handleTaskUnassigned(event: TaskUnassignedEvent) {
    this.logger.log('Start - Handle Task Unassign', TaskEventListener.name);
    try {
      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
      }

      const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

      const task = flowableTasks.find(
        (task: { name: string; processInstanceId: string }) =>
          task.name === event.taskName && task.processInstanceId === processInstance.id,
      );

      if (!task) {
        throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
      }
      await this.flowableTaskService.unclaimTask(task.id as number);

      this.logger.log(`End - Successfully unassigned Flowable task ${task.id}`, TaskEventListener.name);
    } catch (error) {
      throw error;
    }
  }
}
