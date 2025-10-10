import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import axios, { AxiosInstance } from 'axios';
import FormData = require('form-data');

@Injectable()
export class FlowableService implements OnModuleInit {
  private flowableClient: AxiosInstance;
  private readonly flowableUrl: string;
  private readonly flowableAuth: { username: string; password: string };
  private readonly candidateGroups = ['Supervisors', 'Investigations', 'Analysts'];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.flowableUrl = this.configService.get<string>('FLOWABLE_URL', 'http://10.10.80.30:8081/flowable-rest');

    this.flowableAuth = {
      username: this.configService.get<string>('FLOWABLE_USERNAME', 'rest-admin'),
      password: this.configService.get<string>('FLOWABLE_PASSWORD', 'test'),
    };

    this.flowableClient = axios.create({
      baseURL: this.flowableUrl,
      auth: this.flowableAuth,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
  }

  async onModuleInit() {
    try {
      await this.initializeCandidateGroups();
      await this.initializeUsers();
      await this.healthCheckOrFail();
      this.logger.log('Flowable initialized successfully', FlowableService.name);
    } catch (error) {
      this.logger.error(`Failed to initialize Flowable: ${error.message}`, error.stack, FlowableService.name);
      throw new Error(`Flowable initialization failed: ${error.message}`);
    }
  }

  private async initializeCandidateGroups() {
    for (const groupName of this.candidateGroups) {
      try {
        // Check if group exists
        const existingGroup = await this.getGroup(groupName.toLowerCase());

        if (!existingGroup) {
          // Create group if it doesn't exist
          await this.createGroup({
            id: groupName.toLowerCase(),
            name: groupName,
            type: 'candidate',
          });
          this.logger.log(`Created candidate group: ${groupName}`, FlowableService.name);
        } else {
          this.logger.log(`Candidate group already exists: ${groupName}`, FlowableService.name);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize group ${groupName}: ${error.message}`, error.stack, FlowableService.name);
      }
    }
  }

  private async initializeUsers() {
    const systemUsers = [
      {
        id: this.configService.get<string>('SYSTEM_UUID', 'system-user'),
        firstName: 'System',
        lastName: 'User',
        email: 'system@tazama.org',
        password: 'system123',
      },
    ];

    for (const user of systemUsers) {
      try {
        const existingUser = await this.getUser(user.id);

        if (!existingUser) {
          await this.createUser(user);
          this.logger.log(`Created system user: ${user.id}`, FlowableService.name);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize user ${user.id}: ${error.message}`, error.stack, FlowableService.name);
      }
    }
  }

  async createGroup(groupData: { id: string; name: string; type: string }) {
    try {
      const response = await this.flowableClient.post('/service/identity/groups', groupData);
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        // Group already exists
        this.logger.log(`Group ${groupData.id} already exists`, FlowableService.name);
        return null;
      }
      throw new HttpException(`Failed to create group: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getGroup(groupId: string) {
    try {
      const response = await this.flowableClient.get(`/service/identity/groups/${groupId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException(`Failed to get group: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createUser(userData: { id: string; firstName: string; lastName: string; email: string; password: string }) {
    try {
      const response = await this.flowableClient.post('/service/identity/users', userData);
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        // User already exists
        this.logger.log(`User ${userData.id} already exists`, FlowableService.name);
        return null;
      }
      throw new HttpException(`Failed to create user: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getUser(userId: string) {
    try {
      const response = await this.flowableClient.get(`/service/identity/users/${userId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException(`Failed to get user: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async addUserToGroup(userId: string, groupId: string) {
    try {
      const response = await this.flowableClient.post(`/service/identity/groups/${groupId}/members`, {
        userId,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to add user ${userId} to group ${groupId}: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException(`Failed to add user to group: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deployProcess(bpmnXml: string, deploymentName: string, tenantId?: string) {
    try {
      const formData = new FormData();
      const buffer = Buffer.from(bpmnXml);
      formData.append('deployment', buffer, {
        filename: `${deploymentName}.bpmn20.xml`,
        contentType: 'text/xml',
      });

      const headers: Record<string, string> = { ...formData.getHeaders() };
      if (tenantId) {
        headers['tenantId'] = tenantId;
      }

      const response = await this.flowableClient.post('/service/repository/deployments', formData, {
        headers,
      });

      this.logger.log(`Process deployed successfully: ${response.data.id}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to deploy process: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to deploy process', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async startProcessInstance(processDefinitionKey: string, variables: Record<string, any>, businessKey?: string) {
    try {
      const payload = {
        processDefinitionKey,
        variables: this.formatVariables(variables),
        businessKey,
      };

      const response = await this.flowableClient.post('/service/runtime/process-instances', payload);

      this.logger.log(`Process instance started: ${response.data.id}`, FlowableService.name);
      return response.data;
    } catch (error) {
      console.log(error);
      this.logger.error(`Failed to start process instance: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to start process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getProcessInstance(processInstanceId: string) {
    try {
      const response = await this.flowableClient.get(`/service/runtime/process-instances/${processInstanceId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Failed to get process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getProcessInstanceByBusinessKey(businessKey: string) {
    try {
      const response = await this.flowableClient.get('/service/runtime/process-instances', {
        params: {
          businessKey,
        },
      });
      return response.data.data?.[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get process by business key: ${error.message}`, error.stack, FlowableService.name);
      return null;
    }
  }

  async getProcessTasks(processInstanceId: string) {
    try {
      const response = await this.flowableClient.get('/service/runtime/tasks', {
        params: {
          processInstanceId,
        },
      });
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get process tasks: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get process tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createTask(taskData: {
    name: string;
    description?: string;
    assignee?: string;
    candidateGroups?: string[];
    tenantId?: string;
    variables?: Record<string, any>;
  }) {
    try {
      const payload = {
        name: taskData.name,
        description: taskData.description,
        assignee: taskData.assignee,
        tenantId: taskData.tenantId,
      };

      const response = await this.flowableClient.post('/service/runtime/tasks', payload);
      const taskId = response.data.id;

      // Add candidate groups if specified
      if (taskData.candidateGroups && taskData.candidateGroups.length > 0) {
        for (const group of taskData.candidateGroups) {
          await this.assignTaskToCandidateGroup(taskId, group);
        }
      }

      // Add variables if specified
      if (taskData.variables) {
        await this.setTaskVariables(taskId, taskData.variables);
      }

      this.logger.log(`Task created: ${taskId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to create task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async completeTask(taskId: string, variables?: Record<string, any>) {
    try {
      const payload = {
        action: 'complete',
        variables: variables ? this.formatVariables(variables) : [],
      };

      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task completed: ${taskId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to complete task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to complete task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async claimTask(taskId: string, userId: string | null): Promise<any> {
    if (!userId) {
      throw new HttpException('User ID cannot be null for task claiming', HttpStatus.BAD_REQUEST);
    }

    try {
      const payload = {
        action: 'claim',
        assignee: userId,
      };

      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task ${taskId} claimed by user ${userId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to claim task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to claim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async unclaimTask(taskId: string) {
    try {
      const payload = {
        action: 'claim',
        assignee: null,
      };

      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task ${taskId} unclaimed`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to unclaim task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to unclaim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delegateTask(taskId: string, userId: string | null): Promise<any> {
    if (!userId) {
      throw new HttpException('User ID cannot be null for task delegation', HttpStatus.BAD_REQUEST);
    }

    try {
      const payload = {
        action: 'delegate',
        assignee: userId,
      };

      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task ${taskId} delegated to user ${userId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to delegate task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to delegate task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async assignTaskToCandidateGroup(taskId: string, group: string) {
    try {
      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}/identitylinks`, {
        type: 'candidate',
        group: group.toLowerCase(), // Ensure lowercase for consistency
      });

      this.logger.log(`Task ${taskId} assigned to candidate group ${group}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to assign task ${taskId} to candidate group ${group}: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to assign task to candidate group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTaskIdentityLinks(taskId: string) {
    try {
      const response = await this.flowableClient.get(`/service/runtime/tasks/${taskId}/identitylinks`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get task identity links: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get task identity links', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCandidateGroupTasks(candidateGroup: string, includeVariables: boolean = true) {
    try {
      const response = await this.flowableClient.get('/service/runtime/tasks', {
        params: {
          candidateGroup: candidateGroup.toLowerCase(),
          includeTaskLocalVariables: includeVariables,
          includeProcessVariables: includeVariables,
        },
      });

      const tasks = response.data.data || [];

      // Enhance tasks with variable information
      if (includeVariables && tasks.length > 0) {
        const enhancedTasks = await Promise.all(
          tasks.map(async (task: any) => {
            try {
              const variables = await this.getTaskVariables(task.id);
              return { ...task, variables };
            } catch (error) {
              this.logger.warn(`Failed to get variables for task ${task.id}`, FlowableService.name);
              return task;
            }
          }),
        );
        return enhancedTasks;
      }

      return tasks;
    } catch (error) {
      this.logger.error(`Failed to get candidate tasks: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get candidate tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getUserTasks(assignee: string, includeVariables: boolean = true) {
    try {
      const response = await this.flowableClient.get('/service/runtime/tasks', {
        params: {
          assignee,
          includeTaskLocalVariables: includeVariables,
          includeProcessVariables: includeVariables,
        },
      });

      const tasks = response.data.data || [];

      // Enhance tasks with variable information
      if (includeVariables && tasks.length > 0) {
        const enhancedTasks = await Promise.all(
          tasks.map(async (task: any) => {
            try {
              const variables = await this.getTaskVariables(task.id);
              return { ...task, variables };
            } catch (error) {
              this.logger.warn(`Failed to get variables for task ${task.id}`, FlowableService.name);
              return task;
            }
          }),
        );
        return enhancedTasks;
      }

      return tasks;
    } catch (error) {
      this.logger.error(`Failed to get user tasks: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get user tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTenantTasks(
    tenantId: string,
    filters?: {
      candidateGroup?: string;
      assignee?: string;
      unassigned?: boolean;
    },
  ) {
    try {
      const params: any = {
        tenantId,
      };

      if (filters?.candidateGroup) {
        params.candidateGroup = filters.candidateGroup.toLowerCase();
      }
      if (filters?.assignee) {
        params.assignee = filters.assignee;
      }
      if (filters?.unassigned === true) {
        params.unassigned = true;
      }

      const response = await this.flowableClient.get('/service/runtime/tasks', {
        params,
      });

      return response.data.data || [];
    } catch (error) {
      this.logger.error(`Failed to get tenant tasks: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get tenant tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTask(taskId: string) {
    try {
      const response = await this.flowableClient.get(`/service/runtime/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Failed to get task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async setTaskVariables(taskId: string, variables: Record<string, any>) {
    try {
      const formattedVariables = this.formatVariables(variables);

      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}/variables`, formattedVariables);

      this.logger.log(`Variables set for task ${taskId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to set task variables: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to set task variables', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTaskVariables(taskId: string) {
    try {
      const response = await this.flowableClient.get(`/service/runtime/tasks/${taskId}/variables`);

      // Convert array of variables to object
      const variables: Record<string, any> = {};
      if (Array.isArray(response.data)) {
        response.data.forEach((variable: any) => {
          variables[variable.name] = variable.value;
        });
      }

      return variables;
    } catch (error) {
      this.logger.error(`Failed to get task variables: ${error.message}`, error.stack, FlowableService.name);
      return {};
    }
  }

  async updateTaskVariable(taskId: string, variableName: string, value: any) {
    try {
      const response = await this.flowableClient.put(`/service/runtime/tasks/${taskId}/variables/${variableName}`, {
        name: variableName,
        value,
        type: this.getVariableType(value),
      });

      this.logger.log(`Variable ${variableName} updated for task ${taskId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update task variable: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to update task variable', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteTaskVariable(taskId: string, variableName: string) {
    try {
      await this.flowableClient.delete(`/service/runtime/tasks/${taskId}/variables/${variableName}`);
      this.logger.log(`Variable ${variableName} deleted from task ${taskId}`, FlowableService.name);
    } catch (error) {
      this.logger.error(`Failed to delete task variable: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to delete task variable', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async terminateProcessInstance(processInstanceId: string, reason?: string) {
    try {
      const payload = {
        action: 'delete',
        deleteReason: reason || 'Process terminated by system',
      };

      const response = await this.flowableClient.delete(`/service/runtime/process-instances/${processInstanceId}`, {
        data: payload,
      });

      this.logger.log(`Process instance terminated: ${processInstanceId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to terminate process instance: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to terminate process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async suspendProcessInstance(processInstanceId: string) {
    try {
      const payload = {
        action: 'suspend',
      };

      const response = await this.flowableClient.put(`/service/runtime/process-instances/${processInstanceId}`, payload);

      this.logger.log(`Process instance suspended: ${processInstanceId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to suspend process instance: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to suspend process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async activateProcessInstance(processInstanceId: string) {
    try {
      const payload = {
        action: 'activate',
      };

      const response = await this.flowableClient.put(`/service/runtime/process-instances/${processInstanceId}`, payload);

      this.logger.log(`Process instance activated: ${processInstanceId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to activate process instance: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to activate process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getWorkQueueStatistics(candidateGroup?: string) {
    try {
      const groups = candidateGroup ? [candidateGroup] : this.candidateGroups;
      const statistics: Record<string, any> = {};

      for (const group of groups) {
        const tasks = await this.getCandidateGroupTasks(group, false);

        statistics[group] = {
          total: tasks.length,
          unassigned: tasks.filter((t: any) => !t.assignee).length,
          assigned: tasks.filter((t: any) => t.assignee).length,
        };
      }

      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get work queue statistics: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get work queue statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private formatVariables(variables: Record<string, any>) {
    return Object.entries(variables).map(([name, value]) => ({
      name,
      value,
      type: this.getVariableType(value),
    }));
  }
  private getVariableType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'double';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'json';
    return 'string';
  }

  async syncTaskWithDatabase(
    flowableTaskId: string,
    dbTaskData: {
      postgres_task_id: string;
      postgres_case_id: string;
      task_status: string;
      assignee_user_id?: string;
      flowable_case_id?: string;
    },
  ) {
    try {
      const variables = {
        postgres_task_id: dbTaskData.postgres_task_id,
        postgres_case_id: dbTaskData.postgres_case_id,
        task_status: dbTaskData.task_status,
        assignee_user_id: dbTaskData.assignee_user_id || null,
        flowable_case_id: dbTaskData.flowable_case_id || null,
      };

      await this.setTaskVariables(flowableTaskId, variables);

      this.logger.log(`Synced Flowable task ${flowableTaskId} with database task ${dbTaskData.postgres_task_id}`, FlowableService.name);
      return true;
    } catch (error) {
      this.logger.error(`Failed to sync task with database: ${error.message}`, error.stack, FlowableService.name);
      return false;
    }
  }

  async createTaskWithContext(taskData: {
    name: string;
    description: string;
    tenantId: string;
    candidateGroup: string;
    postgresTaskId: string;
    postgresCaseId: string;
    status: string;
  }) {
    try {
      // Create the Flowable task
      const flowableTask = await this.createTask({
        name: taskData.name,
        description: taskData.description,
        tenantId: taskData.tenantId,
        candidateGroups: [taskData.candidateGroup],
        variables: {
          postgres_task_id: taskData.postgresTaskId,
          postgres_case_id: taskData.postgresCaseId,
          task_status: taskData.status,
        },
      });

      this.logger.log(`Created Flowable task ${flowableTask.id} with context for case ${taskData.postgresCaseId}`, FlowableService.name);
      return flowableTask;
    } catch (error) {
      this.logger.error(`Failed to create task with context: ${error.message}`, error.stack, FlowableService.name);
      throw error;
    }
  }

  async getAllCandidateGroups() {
    try {
      const response = await this.flowableClient.get('/service/identity/groups', {
        params: {
          type: 'candidate',
        },
      });
      return response.data.data || [];
    } catch (error) {
      this.logger.error(`Failed to get candidate groups: ${error.message}`, error.stack, FlowableService.name);
      return [];
    }
  }

  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      await this.flowableClient.get('/service/repository/deployments', {
        params: { size: 1 },
      });
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Flowable connection failed: ${error.message}`,
      };
    }
  }

  private async healthCheckOrFail() {
    try {
      const health = await this.healthCheck();
      if (health.status !== 'healthy') {
        throw new Error(health.message || 'Flowable health check failed');
      }
    } catch (err) {
      throw new Error(`Flowable unreachable or unhealthy: ${err.message}`);
    }
  }
}
