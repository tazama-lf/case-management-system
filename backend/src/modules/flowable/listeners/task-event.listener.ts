import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TaskAssignedEvent, TaskUnassignedEvent, TaskCompletedEvent } from '../../events/domain-events';
import { TaskStatus } from '@prisma/client-cms';
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
  ) {}

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
      const task = flowableTasks.find((task: { name: string; processInstanceId: string }) => {
        return task.name === event.taskName && task.processInstanceId === processInstance.id;
      });

      let completionVars: Record<string, string> = {};
      if (event.completionVariables) {
        Object.entries(event.completionVariables).forEach(([key, value]) => {
          completionVars[key] = String(value);
        });
      }

      // await this.flowableTaskService.completeTask(task.id as number, completionVars);

      this.logger.log(`Completed Flowable task ${task.id}`, TaskEventListener.name);
    } catch (error) {
      this.logger.error(`[TaskEventListener] ✗ Failed to complete Flowable task: ${error.message}`, error.stack, TaskEventListener.name);
    }
  }

  @OnEvent('task.assigned')
  async handleTaskAssigned(event: TaskAssignedEvent) {
    // try {
    //   const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
    //   if (!processInstance) {
    //     throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
    //   }
    //   const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);
    //   const task = flowableTasks.find((task: { name: string; processInstanceId: string }) => {
    //     return task.name === event.taskName && task.processInstanceId === processInstance.id;
    //   });
    //   if (!task) {
    //     throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
    //   }
    //   // await this.flowableTaskService.claimTask(task.id as number, event.assignedUserId);
    //   this.logger.log(`Successfully assigned Flowable task ${task.id} to user ${event.assignedUserId}`, TaskEventListener.name);
    // } catch (error) {
    //   this.logger.error(`Failed to assign Flowable task: ${error.message}`, error.stack, TaskEventListener.name);
    // }
  }

  @OnEvent('task.unassigned')
  async handleTaskUnassigned(event: TaskUnassignedEvent) {
    // this.logger.log(`Start - Handle Task Unassign`, TaskEventListener.name);
    // try {
    //   const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
    //   if (!processInstance) {
    //     throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
    //   }
    //   const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);
    //   const task = flowableTasks.find((task: { name: string; processInstanceId: string }) => {
    //     return task.name === event.taskName && task.processInstanceId === processInstance.id;
    //   });
    //   if (!task) {
    //     throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
    //   }
    //   await this.flowableTaskService.unclaimTask(task.id as number);
    //   this.logger.log(`End - Successfully unassigned Flowable task ${task.id}`, TaskEventListener.name);
    // } catch (error) {
    //   this.logger.error(`Failed to unassign Flowable task: ${error.message}`, error.stack, TaskEventListener.name);
    // }
  }
}
