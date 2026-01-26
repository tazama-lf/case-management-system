import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints, FlowableTaskActions } from '../../../constants/flowable-api.constants';
import { FlowableUtilitiesService } from './flowable-utilities.service';
import { FlowableClientFactory } from './flowable-client.factory';
import { FlowableProcessService } from './flowable-process.service';
import { TaskType } from '@prisma/client-cms';
import { formatVariables } from '../utils/formatVariables';
import { FlowableTask } from '../types/IFlowable';

@Injectable()
export class FlowableTaskService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly utilityService: FlowableUtilitiesService,
    private readonly clientFactory: FlowableClientFactory,
    private readonly flowableProcessService: FlowableProcessService,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  async getProcessTasks(processInstanceId: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASKS, {
        params: {
          processInstanceId,
        },
      });

      const tasks = response.data.data;
      const tasksWithVariables = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const variablesResponse = await this.flowableClient.get(FlowableApiEndpoints.TASK_VARIABLES(task.id));
            const variablesArray = variablesResponse.data || [];
            const variablesObject: Record<string, any> = {};

            variablesArray.forEach((v: { name: string; value: string | boolean }) => {
              variablesObject[v.name] = v.value;
            });

            return {
              ...task,
              variablesMap: variablesObject,
            };
          } catch (error) {
            this.logger.warn(`Failed to fetch variables for task ${task.id}: ${error.message}`, FlowableTaskService.name);
            return {
              ...task,
              variablesMap: {},
            };
          }
        }),
      );

      if (!tasksWithVariables.length) {
        this.logger.warn(`No tasks found for process ${processInstanceId}`, FlowableTaskService.name);
        throw new NotFoundException(`No tasks found for process ${processInstanceId}`);
      }
      return tasksWithVariables;
    } catch (error) {
      throw new HttpException('Failed to get process tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async completeFlowableTask(userId: string, caseId: number, taskType: TaskType, completionVariables?: Record<string, unknown>) {
    try {
      // if (event.newStatus !== TaskStatus.STATUS_30_COMPLETED) {
      //   return;
      // }

      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(caseId);
      if (!processInstance) {
        throw new NotFoundException(`No Flowable process found for case ${caseId}`);
      }

      const flowableTasks = await this.getProcessTasks(processInstance.id);
      const task = flowableTasks.find((task: { name: string; category: string; processInstanceId: string }) => {
        return task.category === taskType && task.processInstanceId === processInstance.id;
      });

      // let completionVars: Record<string, string> = {};
      // Object.entries(completionVariables!).forEach(([key, value]) => {
      //   completionVars[key] = String(value);
      // });

      // await this.flowableTaskService.completeTask(task.id as number, completionVars);

      // this.logger.log(`Completed Flowable task ${task.id}`, FlowableTaskService.name);
      // } catch (error) {
      //   this.logger.error(`[TaskEventListener] ✗ Failed to complete Flowable task: ${error.message}`, error.stack, FlowableTaskService.name);
      // }
      // try {
      const payload: Record<string, unknown> = {
        action: FlowableTaskActions.COMPLETE,
        variables: completionVariables ? formatVariables(completionVariables) : [],
      };
      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK(task.taskId), payload);

      this.logger.log(`End - completeFlowableTask: ${task.taskId}`, FlowableTaskService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to complete task: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to complete task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async claimTask(caseId: number, assignee: string, taskType: TaskType): Promise<number> {
    try {
      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(caseId);
      const flowableTasks = await this.getProcessTasks(processInstance.id);

      const task = flowableTasks.find((task: FlowableTask) => {
        return task.category === taskType && task.assignee === null && task.processInstanceId === processInstance.id;
      });
      if (!task) {
        throw new NotFoundException(`No unassigned Flowable task found for case ${caseId} and task type ${taskType}`);
      }

      const payload = {
        action: FlowableTaskActions.CLAIM,
        assignee: assignee,
      };

      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK(task.id), payload);
      return response.status;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException('Failed to unclaim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async unclaimTask(caseId: number, taskType: TaskType): Promise<number> {
    try {
      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(caseId);
      const flowableTasks = await this.getProcessTasks(processInstance.id);

      const task = flowableTasks.find((task: FlowableTask) => {
        return task.category === taskType && task.assignee === null && task.processInstanceId === processInstance.id;
      });
      if (!task) {
        throw new NotFoundException(`No unassigned Flowable task found for case ${caseId} and task type ${taskType}`);
      }
      const payload = {
        action: FlowableTaskActions.CLAIM,
        assignee: null,
      };

      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK(task.id), payload);
      return response.status;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException('Failed to unclaim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCandidateGroupTasks(candidateGroup: string, includeVariables: boolean = true) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASKS, {
        params: {
          candidateGroup: candidateGroup.toLowerCase(),
          includeTaskLocalVariables: includeVariables,
          includeProcessVariables: includeVariables,
        },
      });

      const tasks = response.data.data || [];

      if (includeVariables && tasks.length > 0) {
        const enhancedTasks = await Promise.all(
          tasks.map(async (task: unknown) => {
            const taskObj = task as Record<string, unknown>;
            try {
              const variables = await this.utilityService.getTaskVariables(taskObj.id as number);
              return { ...taskObj, variables };
            } catch (error) {
              this.logger.warn(`Failed to get variables for task ${taskObj.id}`, FlowableTaskService.name);
              return taskObj;
            }
          }),
        );
        return enhancedTasks;
      }

      return tasks;
    } catch (error) {
      this.logger.error(`Failed to get candidate tasks: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to get candidate tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
