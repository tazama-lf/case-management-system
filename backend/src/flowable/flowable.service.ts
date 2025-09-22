import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class FlowableService {
  private flowableClient: AxiosInstance;
  private readonly flowableUrl: string;
  private readonly flowableAuth: { username: string; password: string };

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.flowableUrl = this.configService.get<string>('FLOWABLE_URL', 'http://localhost:8080/flowable-rest');

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
    });
  }

  /**
   * Deploy a BPMN process definition to Flowable
   */
  async deployProcess(bpmnXml: string, deploymentName: string) {
    try {
      const formData = new FormData();
      const blob = new Blob([bpmnXml], { type: 'text/xml' });
      formData.append('deployment', blob, `${deploymentName}.bpmn20.xml`);

      const response = await this.flowableClient.post('/service/repository/deployments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      this.logger.log(`Process deployed successfully: ${response.data.id}`, FlowableService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to deploy process: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to deploy process', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Start a process instance
   */
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
      this.logger.error(`Failed to start process instance: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to start process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get process instance by ID
   */
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

  /**
   * Get tasks for a process instance
   */
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

  /**
   * Complete a task
   */
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

  /**
   * Claim a task for a user
   */
  async claimTask(taskId: string, userId: string) {
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

  async assignTaskToCandidateGroup(taskId: string, group: string) {
    try {
      const response = await this.flowableClient.post(`/service/runtime/tasks/${taskId}/identitylinks`, {
        type: 'candidate',
        group,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to assign task ${taskId} to candidate group ${group}: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException(`Failed to assign task to candidate group`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get candidate tasks for a group
   */
  async getCandidateGroupTasks(candidateGroup: string) {
    try {
      const response = await this.flowableClient.get('/service/runtime/tasks', {
        params: {
          candidateGroup,
        },
      });
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get candidate tasks: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get candidate tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get user tasks
   */
  async getUserTasks(assignee: string) {
    try {
      const response = await this.flowableClient.get('/service/runtime/tasks', {
        params: {
          assignee,
        },
      });
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get user tasks: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to get user tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Format variables for Flowable API
   */
  private formatVariables(variables: Record<string, any>) {
    return Object.entries(variables).map(([name, value]) => ({
      name,
      value,
      type: this.getVariableType(value),
    }));
  }

  /**
   * Determine variable type for Flowable
   */
  private getVariableType(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'double';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'json';
    return 'string';
  }
}
