import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints, FlowableTaskActions } from '../../../constants/flowable-api.constants';
import { CreateFlowableTaskDto, FlowableTask, FlowableVariable } from '../dto/flowable.dto';
import { FlowableClientFactory } from './flowable-client.factory';

@Injectable()
export class FlowableTaskService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  /**
   * Create a new standalone task or add to a process
   */
  async createTask(taskData: CreateFlowableTaskDto): Promise<FlowableTask> {
    try {
      const payload: Record<string, unknown> = {
        name: taskData.name,
        description: taskData.description,
        assignee: taskData.assignee,
      };

      if (taskData.variables) {
        payload.variables = this.formatVariables(taskData.variables);
      }

      const response = await this.flowableClient.post(FlowableApiEndpoints.TASKS, payload);
      const taskId = response.data.id;

      this.logger.log(`Task created: ${taskId}`, FlowableTaskService.name);
      return response.data as FlowableTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create task: ${errorMessage}`, errorStack, FlowableTaskService.name);
      throw new HttpException('Failed to create task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getProcessTasks(processInstanceId: string): Promise<FlowableTask[]> {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASKS, {
        params: {
          processInstanceId,
        },
      });

      const tasks = response.data.data ?? [];

      const tasksWithVariables = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const variablesResponse = await this.flowableClient.get(FlowableApiEndpoints.TASK_VARIABLES(task.id));
            const variablesArray = variablesResponse.data ?? [];
            const variablesObject: Record<string, any> = {};

            variablesArray.forEach((v: any) => {
              variablesObject[v.name] = v.value;
            });

            return {
              ...task,
              variables: variablesArray,
              variablesMap: variablesObject,
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to fetch variables for task ${task.id}: ${errorMessage}`, FlowableTaskService.name);
            return {
              ...task,
              variables: [],
              variablesMap: {},
            };
          }
        }),
      );

      this.logger.log(
        `Retrieved ${tasksWithVariables.length} tasks with variables for process ${processInstanceId}`,
        FlowableTaskService.name,
      );

      return tasksWithVariables;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get process tasks: ${errorMessage}`, errorStack, FlowableTaskService.name);
      throw new HttpException('Failed to get process tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async completeTask(taskId: string, variables?: Record<string, string>): Promise<FlowableTask> {
    try {
      const payload: Record<string, unknown> = {
        action: FlowableTaskActions.COMPLETE,
        variables: variables ? this.formatVariables(variables) : [],
      };
      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task completed: ${taskId}`, FlowableTaskService.name);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to complete task: ${errorMessage}`, errorStack, FlowableTaskService.name);
      throw new HttpException('Failed to complete task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async claimTask(taskId: string, userId: string): Promise<void> {
    try {
      const payload = {
        action: FlowableTaskActions.CLAIM,
        assignee: userId,
      };

      await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task ${taskId} claimed by user ${userId}`, FlowableTaskService.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to claim task: ${errorMessage}`, errorStack, FlowableTaskService.name);
      throw new HttpException('Failed to claim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async unclaimTask(taskId: string): Promise<void> {
    try {
      const payload = {
        action: FlowableTaskActions.CLAIM,
        assignee: null,
      };

      await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task ${taskId} unclaimed`, FlowableTaskService.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to unclaim task: ${errorMessage}`, errorStack, FlowableTaskService.name);
      throw new HttpException('Failed to unclaim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateTaskVariable(taskId: number, variableName: string, value: string): Promise<FlowableTask> {
    try {
      const response = await this.flowableClient.put(FlowableApiEndpoints.TASK_VARIABLE(taskId, variableName), {
        name: variableName,
        value,
        type: 'string',
      });

      this.logger.log(`Variable ${variableName} updated for task ${taskId}`, FlowableTaskService.name);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update task variable: ${errorMessage}`, errorStack, FlowableTaskService.name);
      throw new HttpException('Failed to update task variable', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private formatVariables(variables: Record<string, string>): FlowableVariable[] {
    return Object.entries(variables).map(([name, value]) => ({
      name,
      value,
      type: 'string',
    }));
  }
}
