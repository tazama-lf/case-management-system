import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData = require('form-data');

interface FlowableVariable {
  name: string;
  value: string;
  type: 'string';
}

@Injectable()
export class FlowableService implements OnModuleInit {
  private flowableClient: AxiosInstance;
  private readonly flowableUrl: string;
  private readonly flowableAuth: { username: string; password: string };
  private readonly candidateGroups = ['Supervisors', 'Investigations', 'Investigator'];
  private readonly tenantId = 'c950ac85-96f0-4390-8d94-5b8fdec4e863';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000;

  constructor(
      private readonly configService: ConfigService,
      private readonly logger: LoggerService,
  ) {
    this.flowableUrl = this.configService.get<string>('FLOWABLE_URL', 'http://10.10.80.30:8081/flowable-rest');

    this.flowableAuth = {
      username: this.configService.get<string>('FLOWABLE_USERNAME', 'rest-admin'),
      password: this.configService.get<string>('FLOWABLE_PASSWORD', 'test'),
    };

    const timeoutMs = this.configService.get<number>('FLOWABLE_TIMEOUT_MS', 10000);

    this.flowableClient = axios.create({
      baseURL: this.flowableUrl,
      auth: this.flowableAuth,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    });
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(`Initializing Flowable (attempt ${attempt}/${this.maxRetries})`, FlowableService.name);

        await this.healthCheck();
        await this.deployBpmnProcess();
        await this.initializeCandidateGroups();

        this.logger.log('Flowable initialized successfully', FlowableService.name);
        return;
      } catch (error) {
        this.logger.error(
            `Failed to initialize Flowable (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
            error.stack,
            FlowableService.name,
        );

        if (attempt === this.maxRetries) {
          this.logger.error('Max retry attempts reached. CMS cannot start without Flowable.', error.stack, FlowableService.name);
          throw new Error(`Flowable initialization failed after ${this.maxRetries} attempts: ${error.message}`);
        }

        this.logger.log(`Retrying Flowable initialization in ${this.retryDelayMs / 1000} seconds...`, FlowableService.name);
        await this.sleep(this.retryDelayMs);
      }
    }
  }

  private async deployBpmnProcess() {
    const bpmnFilePath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');

    try {
      this.logger.log('Deploying BPMN process', FlowableService.name);

      const bpmnXml = await fs.readFile(bpmnFilePath, 'utf-8');
      const formData = new FormData();
      const buffer = Buffer.from(bpmnXml);

      formData.append('deployment', buffer, {
        filename: 'UnifiedCaseManagementProcess.bpmn20.xml',
        contentType: 'text/xml',
      });

      const headers: Record<string, string> = { ...formData.getHeaders() };

      const response = await this.flowableClient.post('/service/repository/deployments', formData, {
        headers,
        params: {
          tenantId: this.tenantId,
        },
      });

      this.logger.log(`BPMN process deployed successfully: ${response.data.id}`, FlowableService.name);
      return response.data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.error(`BPMN file not found at ${bpmnFilePath}. Cannot start CMS without BPMN process.`, error.stack, FlowableService.name);
        throw new Error(`Critical: BPMN file not found at ${bpmnFilePath}`);
      }

      this.logger.error(`Failed to deploy BPMN process: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to deploy BPMN process', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async initializeCandidateGroups() {
    for (const groupName of this.candidateGroups) {
      try {
        const existingGroup = await this.getGroup(groupName.toLowerCase());

        if (!existingGroup) {
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

  /**
   * Ensure a user is a member of a Flowable identity group
   */
  async addUserToGroup(groupId: string, userId: string) {
    try {
      const response = await this.flowableClient.post(`/service/identity/groups/${groupId}/members`, {
        userId,
      });
      return response.data;
    } catch (error) {
      // 409 means membership already exists; treat as success
      if (error.response?.status === 409) {
        this.logger.log(`User ${userId} already a member of group ${groupId}`, FlowableService.name);
        return null;
      }
      this.logger.error(`Failed to add user ${userId} to group ${groupId}: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to add user to group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Remove a user from a Flowable identity group
   */
  async removeUserFromGroup(groupId: string, userId: string) {
    try {
      await this.flowableClient.delete(`/service/identity/groups/${groupId}/members/${userId}`);
    } catch (error) {
      if (error.response?.status === 404) {
        // Not a member; ignore
        return;
      }
      this.logger.error(`Failed to remove user ${userId} from group ${groupId}: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to remove user from group', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createGroup(groupData: { id: string; name: string; type: string }) {
    try {
      const response = await this.flowableClient.post('/service/identity/groups', groupData);
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
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

  async startProcessInstance(processDefinitionKey: string, variables: Record<string, string>, businessKey: string) {
    try {
      // First, verify the process definition exists
      const processDefinitions = await this.getProcessDefinitions(processDefinitionKey);
      if (!processDefinitions || processDefinitions.length === 0) {
        throw new Error(`Process definition '${processDefinitionKey}' not found. Available definitions: ${await this.listProcessDefinitions()}`);
      }

      const formattedVariables = this.formatVariables(variables);
      const payload = {
        processDefinitionKey,
        variables: formattedVariables,
        businessKey,
        tenantId: this.tenantId, // Add tenant ID to payload
      };

      this.logger.log(`Starting process instance with payload: ${JSON.stringify({
        processDefinitionKey,
        businessKey,
        tenantId: this.tenantId,
        variableCount: formattedVariables.length,
        variables: formattedVariables.map(v => `${v.name}=${v.value}`).join(', ')
      })}`, FlowableService.name);

      const response = await this.flowableClient.post('/service/runtime/process-instances', payload);

      this.logger.log(`Process instance started: ${response.data.id} with businessKey: ${businessKey}`, FlowableService.name);
      return response.data;
    } catch (error) {
      // Enhanced error logging with more details
      if (error.response) {
        this.logger.error(`Flowable API error - Status: ${error.response.status}`, FlowableService.name);
        this.logger.error(`Flowable API error - Response: ${JSON.stringify(error.response.data)}`, FlowableService.name);
        this.logger.error(`Flowable API error - Headers: ${JSON.stringify(error.response.headers)}`, FlowableService.name);
      }
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
      const response = await this.flowableClient.get('/service/runtime/tasks?includeTaskLocalVariables=true', {
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
    variables?: Record<string, string>;
    priority?: number;
    dueDate?: string;
  }) {
    try {
      const payload: Record<string, unknown> = {
        name: taskData.name,
        description: taskData.description,
        assignee: taskData.assignee,
        tenantId: taskData.tenantId,
        priority: taskData.priority || 50,
      };

      if (taskData.dueDate) {
        payload.dueDate = taskData.dueDate;
      }

      if (taskData.candidateGroups && taskData.candidateGroups.length > 0) {
        payload.candidateGroups = taskData.candidateGroups;
      }

      if (taskData.variables) {
        payload.variables = this.formatVariables(taskData.variables);
      }

      const response = await this.flowableClient.post('/service/runtime/tasks', payload);
      const taskId = response.data.id;

      this.logger.log(`Task created: ${taskId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to create task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async completeTask(taskId: string, variables?: Record<string, string>) {
    try {
      const payload: Record<string, unknown> = {
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

  async claimTask(taskId: string, userId: string): Promise<void> {
    try {
      const payload = {
        action: 'claim',
        assignee: userId,
      };

      await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task ${taskId} claimed by user ${userId}`, FlowableService.name);
    } catch (error) {
      this.logger.error(`Failed to claim task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to claim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async unclaimTask(taskId: string): Promise<void> {
    try {
      const payload = {
        action: 'claim',
        assignee: null,
      };

      await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task ${taskId} unclaimed`, FlowableService.name);
    } catch (error) {
      this.logger.error(`Failed to unclaim task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to unclaim task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delegateTask(taskId: string, userId: string): Promise<void> {
    try {
      const payload = {
        action: 'delegate',
        assignee: userId,
      };

      await this.flowableClient.post(`/service/runtime/tasks/${taskId}`, payload);

      this.logger.log(`Task ${taskId} delegated to user ${userId}`, FlowableService.name);
    } catch (error) {
      this.logger.error(`Failed to delegate task: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to delegate task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async assignTaskToCandidateGroup(taskId: string, group: string) {
    try {
      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}/identitylinks`, {
        type: 'candidate',
        group: group.toLowerCase(),
      });

      this.logger.log(`Task ${taskId} assigned to candidate group ${group}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(
          `Failed to assign task ${taskId} to candidate group ${group}: ${error.message}`,
          error.stack,
          FlowableService.name,
      );
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

      if (includeVariables && tasks.length > 0) {
        const enhancedTasks = await Promise.all(
            tasks.map(async (task: unknown) => {
              const taskObj = task as Record<string, unknown>;
              try {
                const variables = await this.getTaskVariables(taskObj.id as string);
                return { ...taskObj, variables };
              } catch (error) {
                this.logger.warn(`Failed to get variables for task ${taskObj.id}`, FlowableService.name);
                return taskObj;
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

      if (includeVariables && tasks.length > 0) {
        const enhancedTasks = await Promise.all(
            tasks.map(async (task: unknown) => {
              const taskObj = task as Record<string, unknown>;
              try {
                const variables = await this.getTaskVariables(taskObj.id as string);
                return { ...taskObj, variables };
              } catch (error) {
                this.logger.warn(`Failed to get variables for task ${taskObj.id}`, FlowableService.name);
                return taskObj;
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

  async setProcessVariables(processInstanceId: string, variables: Record<string, string>) {
    try {
      const formattedVariables = this.formatVariables(variables);

      const response = await this.flowableClient.post(`/service/runtime/process-instances/${processInstanceId}/variables`, formattedVariables);

      this.logger.log(`Variables set successfully for process ${processInstanceId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to set process variables: ${error.message}`, error.stack, FlowableService.name);

      if (error.response) {
        this.logger.error(`Flowable API error response: ${JSON.stringify(error.response.data)}`, FlowableService.name);
        this.logger.error(`Status code: ${error.response.status}`, FlowableService.name);
      }

      throw new HttpException('Failed to set process variables', HttpStatus.INTERNAL_SERVER_ERROR);
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
      const params: Record<string, unknown> = {
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

      const response = await this.flowableClient.get('/service/runtime/tasks?includeTaskLocalVariables=true', {
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

  async setTaskVariables(taskId: string, variables: Record<string, string>) {
    try {
      const formattedVariables = this.formatVariables(variables);

      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}/variables`, formattedVariables);

      this.logger.log(`Variables set successfully for task ${taskId}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to set task variables: ${error.message}`, error.stack, FlowableService.name);

      if (error.response) {
        this.logger.error(`Flowable API error response: ${JSON.stringify(error.response.data)}`, FlowableService.name);
        this.logger.error(`Status code: ${error.response.status}`, FlowableService.name);
      }

      throw new HttpException('Failed to set task variables', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getTaskVariables(taskId: string): Promise<Record<string, string>> {
    try {
      const response = await this.flowableClient.get(`/service/runtime/tasks/${taskId}/variables`);

      const variables: Record<string, string> = {};
      if (Array.isArray(response.data)) {
        response.data.forEach((variable: unknown) => {
          const varObj = variable as Record<string, unknown>;
          variables[varObj.name as string] = varObj.value as string;
        });
      }

      return variables;
    } catch (error) {
      this.logger.error(`Failed to get task variables: ${error.message}`, error.stack, FlowableService.name);
      return {};
    }
  }

  async updateTaskVariable(taskId: string, variableName: string, value: string) {
    try {
      const response = await this.flowableClient.put(`/service/runtime/tasks/${taskId}/variables/${variableName}`, {
        name: variableName,
        value,
        type: 'string',
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
      const statistics: Record<string, unknown> = {};

      for (const group of groups) {
        const tasks = await this.getCandidateGroupTasks(group, false);

        statistics[group] = {
          total: tasks.length,
          unassigned: tasks.filter((t: unknown) => !(t as Record<string, unknown>).assignee).length,
          assigned: tasks.filter((t: unknown) => !!(t as Record<string, unknown>).assignee).length,
        };
      }

      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get work queue statistics: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get work queue statistics', HttpStatus.INTERNAL_SERVER_ERROR);
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
      throw new Error(`Flowable connection failed: ${error.message}`);
    }
  }

  async getProcessDefinitions(processDefinitionKey?: string) {
    try {
      const params: Record<string, unknown> = {};
      if (processDefinitionKey) {
        params.key = processDefinitionKey;
      }
      params.tenantId = this.tenantId;

      const response = await this.flowableClient.get('/service/repository/process-definitions', {
        params,
      });
      return response.data.data || [];
    } catch (error) {
      this.logger.error(`Failed to get process definitions: ${error.message}`, error.stack, FlowableService.name);
      return [];
    }
  }

  async listProcessDefinitions(): Promise<string> {
    try {
      const definitions = await this.getProcessDefinitions();
      return definitions.map((def: any) => def.key).join(', ');
    } catch (error) {
      return 'Unable to list process definitions';
    }
  }

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}