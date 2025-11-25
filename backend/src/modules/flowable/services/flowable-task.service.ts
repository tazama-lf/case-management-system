import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints, FlowableDefaults, FlowableTaskActions } from '../constants/flowable-api.constants';
import { CreateFlowableTaskDto, FlowableVariable } from '../dto/flowable.dto';
import { FlowableUtilitiesService } from '../utils/flowable-utilities.service';
import { FlowableClientFactory } from './flowable-client.factory';

/**
 * Service responsible for Flowable task operations
 * Handles creating, querying, updating, and managing tasks
 */
@Injectable()
export class FlowableTaskService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly utilityService: FlowableUtilitiesService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  /**
   * Create a new standalone task or add to a process
   */
  async createTask(taskData: CreateFlowableTaskDto) {
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
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create task: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to create task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASK(taskId));
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Failed to get task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get all tasks for a process instance
   */
  async getProcessTasks(processInstanceId: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASKS, {
        params: {
          processInstanceId,
        },
      });

      const tasks = response.data.data || [];

      const tasksWithVariables = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const variablesResponse = await this.flowableClient.get(FlowableApiEndpoints.TASK_VARIABLES(task.id));
            const variablesArray = variablesResponse.data || [];
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
            this.logger.warn(`Failed to fetch variables for task ${task.id}: ${error.message}`, FlowableTaskService.name);
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
      this.logger.error(`Failed to get process tasks: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to get process tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, variables?: Record<string, string>) {
    try {
      const payload: Record<string, unknown> = {
        action: FlowableTaskActions.COMPLETE,
        variables: variables ? this.formatVariables(variables) : [],
      };
      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task completed: ${taskId}`, FlowableTaskService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to complete task: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to complete task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Claim a task for a user
   */
  async claimTask(taskId: string, userId: string): Promise<void> {
    try {
      const payload = {
        action: FlowableTaskActions.CLAIM,
        assignee: userId,
      };

      await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task ${taskId} claimed by user ${userId}`, FlowableTaskService.name);
    } catch (error) {
      this.logger.error(`Failed to claim task: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to claim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Unclaim a task (remove assignee)
   */
  async unclaimTask(taskId: string): Promise<void> {
    try {
      const payload = {
        action: FlowableTaskActions.CLAIM,
        assignee: null,
      };

      await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task ${taskId} unclaimed`, FlowableTaskService.name);
    } catch (error) {
      this.logger.error(`Failed to unclaim task: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to unclaim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Delegate a task to another user
   */
  async delegateTask(taskId: string, userId: string): Promise<void> {
    try {
      const payload = {
        action: FlowableTaskActions.DELEGATE,
        assignee: userId,
      };

      await this.flowableClient.post(FlowableApiEndpoints.TASK(taskId), payload);

      this.logger.log(`Task ${taskId} delegated to user ${userId}`, FlowableTaskService.name);
    } catch (error) {
      this.logger.error(`Failed to delegate task: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to delegate task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Assign a task to a candidate group
   */
  async assignTaskToCandidateGroup(taskId: string, group: string) {
    try {
      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK_IDENTITY_LINKS(taskId), {
        type: 'candidate',
        group: group.toLowerCase(),
      });

      this.logger.log(`Task ${taskId} assigned to candidate group ${group}`, FlowableTaskService.name);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to assign task ${taskId} to candidate group ${group}: ${error.message}`,
        error.stack,
        FlowableTaskService.name,
      );
      throw new HttpException('Failed to assign task to candidate group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get identity links for a task (assignees, candidates, etc.)
   */
  async getTaskIdentityLinks(taskId: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASK_IDENTITY_LINKS(taskId));
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get task identity links: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to get task identity links', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get tasks for a candidate group
   */
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
              const variables = await this.utilityService.getTaskVariables(taskObj.id as string);
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

  /**
   * Get tasks assigned to a specific user
   */
  async getUserTasks(assignee: string, includeVariables: boolean = true) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASKS, {
        params: {
          assignee,
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
              const variables = await this.utilityService.getTaskVariables(taskObj.id as string);
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
      this.logger.error(`Failed to get tasks: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to get user tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // /**
  //  * Get tasks for a tenant with optional filters
  //  */
  // async getTenantTasks(
  //   filters?: {
  //     candidateGroup?: string;
  //     assignee?: string;
  //     unassigned?: boolean;
  //   },
  // ) {
  //   try {
  //     const params: Record<string, unknown> = {
  //       tenantId: this.clientFactory.tenantId,
  //     };

  //     if (filters?.candidateGroup) {
  //       params.candidateGroup = filters.candidateGroup.toLowerCase();
  //     }
  //     if (filters?.assignee) {
  //       params.assignee = filters.assignee;
  //     }
  //     if (filters?.unassigned === true) {
  //       params.unassigned = true;
  //     }

  //     const response = await this.flowableClient.get(`${FlowableApiEndpoints.TASKS}?includeTaskLocalVariables=true`, {
  //       params,
  //     });

  //     return response.data.data || [];
  //   } catch (error) {
  //     this.logger.error(`Failed to get tenant tasks: ${error.message}`, error.stack, FlowableTaskService.name);
  //     throw new HttpException('Failed to get tenant tasks', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }

  /**
   * Set multiple task variables
   */
  async setTaskVariables(taskId: string, variables: Record<string, string>) {
    try {
      const formattedVariables = this.formatVariables(variables);

      const response = await this.flowableClient.post(FlowableApiEndpoints.TASK_VARIABLES(taskId), formattedVariables);

      this.logger.log(`Variables set successfully for task ${taskId}: ${JSON.stringify(variables)}`, FlowableTaskService.name);

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to set task variables for task ${taskId}: ${error.message}`, error.stack, FlowableTaskService.name);

      if (error.response) {
        this.logger.error(`Flowable API error response: ${JSON.stringify(error.response.data)}`, FlowableTaskService.name);
        this.logger.error(`Status code: ${error.response.status}`, FlowableTaskService.name);
      }

      throw new HttpException('Failed to set task variables', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update a single task variable
   */
  async updateTaskVariable(taskId: string, variableName: string, value: string) {
    try {
      const response = await this.flowableClient.put(FlowableApiEndpoints.TASK_VARIABLE(taskId, variableName), {
        name: variableName,
        value,
        type: 'string',
      });

      this.logger.log(`Variable ${variableName} updated for task ${taskId}`, FlowableTaskService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update task variable: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to update task variable', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Delete a task variable
   */
  async deleteTaskVariable(taskId: string, variableName: string) {
    try {
      await this.flowableClient.delete(FlowableApiEndpoints.TASK_VARIABLE(taskId, variableName));
      this.logger.log(`Variable ${variableName} deleted from task ${taskId}`, FlowableTaskService.name);
    } catch (error) {
      this.logger.error(`Failed to delete task variable: ${error.message}`, error.stack, FlowableTaskService.name);
      throw new HttpException('Failed to delete task variable', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Format variables for Flowable API
   */
  private formatVariables(variables: Record<string, string>): FlowableVariable[] {
    return Object.entries(variables).map(([name, value]) => {
      if (value === undefined) {
        throw new Error(`Variable "${name}" has undefined value. All variables must have string values.`);
      }
      return {
        name,
        value: String(value),
        type: 'string',
      };
    });
  }
}
