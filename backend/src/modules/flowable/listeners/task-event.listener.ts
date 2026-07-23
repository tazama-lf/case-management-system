import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TaskAssignedEvent, TaskUnassignedEvent, TaskCompletedEvent } from '../../events/domain-events';
import { TaskStatus } from '@prisma/client-cms';
import { FlowableTaskService } from '../services/flowable-task.service';
import { FlowableProcessService } from '../services/flowable-process.service';
import { FlowableTask } from '../dto/flowable.dto';

@Injectable()
export class TaskEventListener {
  constructor(
    private readonly flowableTaskService: FlowableTaskService,
    private readonly flowableProcessService: FlowableProcessService,
    private readonly logger: LoggerService,
  ) {}

  async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    if (event.newStatus !== TaskStatus.STATUS_30_COMPLETED) {
      return;
    }

    const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
    if (!processInstance) {
      throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
    }

    const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);
    const task = flowableTasks.find((task: FlowableTask) => task.name === event.taskName && task.processInstanceId === processInstance.id);
    if (!task) {
      throw new NotFoundException('Flowable task not found for PostgreSQL task');
    }

    const completionVars: Record<string, string> = {};
    if (event.completionVariables) {
      Object.entries(event.completionVariables).forEach(([key, value]) => {
        completionVars[key] = String(value);
      });
    }

    await this.flowableTaskService.completeTask(task.id, completionVars);

    this.logger.log(`Completed Flowable task ${task.id}`, TaskEventListener.name);
  }

  async handleTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
    if (!processInstance) {
      throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
    }

    const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

    const task = flowableTasks.find((task: FlowableTask) => task.name === event.taskName && task.processInstanceId === processInstance.id);

    if (!task) {
      throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
    }

    await this.flowableTaskService.claimTask(task.id, event.assignedUserId);

    this.logger.log(`Successfully assigned Flowable task ${task.id} to user ${event.assignedUserId}`, TaskEventListener.name);
  }

  async handleTaskUnassigned(event: TaskUnassignedEvent): Promise<void> {
    this.logger.log('Start - Handle Task Unassign', TaskEventListener.name);
    const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);
    if (!processInstance) {
      throw new NotFoundException(`No Flowable process found for case ${event.caseId}`);
    }

    const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);

    const task = flowableTasks.find((task: FlowableTask) => task.name === event.taskName && task.processInstanceId === processInstance.id);

    if (!task) {
      throw new NotFoundException(`Flowable task not found for PostgreSQL task ${event.taskId}`);
    }
    await this.flowableTaskService.unclaimTask(task.id);

    this.logger.log(`End - Successfully unassigned Flowable task ${task.id}`, TaskEventListener.name);
  }
}
