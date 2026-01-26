import { Injectable, HttpException, HttpStatus, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData = require('form-data');
import { FlowableApiEndpoints, FlowableDefaults } from '../../constants/flowable-api.constants';
import { FlowableProcessService } from './services/flowable-process.service';
import { FlowableTaskService } from './services/flowable-task.service';
import { FlowableIdentityService } from './services/flowable-identity.service';
import { FlowableClientFactory } from './services/flowable-client.factory';
import { CaseEventListener } from './listeners/case-event.listener';
import { TaskEventListener } from './listeners/task-event.listener';
import {
  TaskAssignedEvent,
  TaskUnassignedEvent,
  CaseAbandonedEvent,
  CaseCreatedEvent,
  CaseStatusChangedEvent,
  TaskCompletedEvent,
  CaseSuspendedEvent,
} from '../events/domain-events';

@Injectable()
export class FlowableService implements OnModuleInit {
  private flowableClient: AxiosInstance;
  private readonly flowableUrl: string;
  private readonly maxRetries = FlowableDefaults.MAX_RETRIES;
  private readonly retryDelayMs = FlowableDefaults.RETRY_DELAY_MS;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
    private readonly processService: FlowableProcessService,
    private readonly flowableTaskService: FlowableTaskService,
    private readonly identityService: FlowableIdentityService,
    private readonly caseEventListener: CaseEventListener,
    private readonly taskEventListener: TaskEventListener,
  ) {
    this.flowableClient = this.clientFactory.getClient();
    this.flowableUrl = this.clientFactory.getBaseUrl();
  }

  async onModuleInit() {
    // Check if Flowable is enabled
    const flowableEnabled = this.configService.get<boolean>('FLOWABLE_ENABLED', true);

    if (!flowableEnabled) {
      this.logger.log('Flowable is disabled via configuration, skipping initialization', FlowableService.name);
      return;
    }

    this.logger.log(`Attempting to connect to Flowable at: ${this.flowableUrl}`, FlowableService.name);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(`Initializing Flowable (attempt ${attempt}/${this.maxRetries})`, FlowableService.name);

        await this.healthCheck();
        await this.deployBpmnProcess();

        this.logger.log('Flowable initialized successfully', FlowableService.name);
        return;
      } catch (error) {
        this.logger.error(
          `Failed to initialize Flowable (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
          error.stack,
          FlowableService.name,
        );

        if (attempt === this.maxRetries) {
          // Make this a warning instead of error to allow application to start
          const skipOnFailure = this.configService.get<boolean>('FLOWABLE_SKIP_ON_FAILURE', false);

          if (skipOnFailure) {
            this.logger.warn(
              `Flowable initialization failed after ${this.maxRetries} attempts. Continuing without Flowable as FLOWABLE_SKIP_ON_FAILURE=true`,
              FlowableService.name,
            );
            return;
          } else {
            this.logger.error('Max retry attempts reached. CMS cannot start without Flowable.', error.stack, FlowableService.name);
            throw new Error(`Flowable initialization failed after ${this.maxRetries} attempts: ${error.message}`);
          }
        }

        this.logger.log(`Retrying Flowable initialization in ${this.retryDelayMs / 1000} seconds...`, FlowableService.name);
        await this.sleep(this.retryDelayMs);
      }
    }
  }

  private async deployBpmnProcess() {
    const bpmnFilePath = path.join(process.cwd(), 'src', 'modules', 'bpmn', 'cms.bpmn20.xml');

    try {
      this.logger.log('Deploying BPMN process', FlowableService.name);

      const bpmnXml = await fs.readFile(bpmnFilePath, 'utf-8');
      const formData = new FormData();
      const buffer = Buffer.from(bpmnXml);

      formData.append('deployment', buffer, {
        filename: 'cms.bpmn20.xml',
        contentType: 'text/xml',
      });

      const headers: Record<string, string> = { ...formData.getHeaders() };

      const response = await this.flowableClient.post(FlowableApiEndpoints.DEPLOYMENTS, formData, {
        headers,
      });

      this.logger.log(`BPMN process deployed successfully: ${response.data.id}`, FlowableService.name);
      return response.data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.error(
          `BPMN file not found at ${bpmnFilePath}. Cannot start CMS without BPMN process.`,
          error.stack,
          FlowableService.name,
        );
        throw new Error(`Critical: BPMN file not found at ${bpmnFilePath}`);
      }

      this.logger.error(`Failed to deploy BPMN process: ${error.message}`, error.stack, FlowableService.name);
      throw new HttpException('Failed to deploy BPMN process', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createGroup(groupData: { id: string; name: string; type: string }) {
    return this.identityService.createGroup(groupData);
  }

  async getGroup(groupId: string) {
    return this.identityService.getGroup(groupId);
  }

  async startProcessInstance(processDefinitionKey: string, variables: Record<string, string>, businessKey: number, tenantId?: string) {
    return this.processService.startProcessInstance(processDefinitionKey, variables, businessKey, tenantId);
  }

  async getProcessInstanceByBusinessKey(businessKey: number) {
    return this.processService.getProcessInstanceByBusinessKey(businessKey);
  }

  async getProcessTasks(processInstanceId: string) {
    return this.flowableTaskService.getProcessTasks(processInstanceId);
  }

  // async claimTask(taskId: number, userId: string): Promise<void> {
  //   return this.flowableTaskService.claimTask(taskId, userId);
  // }

  async unclaimTask(taskId: number): Promise<void> {
    return this.flowableTaskService.unclaimTask(taskId);
  }

  async getCandidateGroupTasks(candidateGroup: string, includeVariables: boolean = true) {
    return this.flowableTaskService.getCandidateGroupTasks(candidateGroup, includeVariables);
  }

  // async updateProcessVariable(processInstanceId: string, variableName: string, value: any): Promise<void> {
  //   return this.processService.updateProcessVariable(processInstanceId, variableName, value);
  // }

  // async setProcessVariables(processInstanceId: string, variables: Record<string, string>) {
  //   return this.processService.setProcessVariables(processInstanceId, variables);
  // }

  // Usage: Abandon Case
  async terminateProcessInstance(processInstanceId: string, reason?: string) {
    return this.processService.terminateProcessInstance(processInstanceId, reason);
  }

  async getWorkQueueStatistics(candidateGroup?: string) {
    return this.identityService.getWorkQueueStatistics(
      this.flowableClient,
      (group: string, includeVariables: boolean) => this.getCandidateGroupTasks(group, includeVariables),
      candidateGroup,
    );
  }

  async getAllCandidateGroups(size?: number, start?: number) {
    return this.identityService.getAllCandidateGroups(size, start);
  }

  async handleCaseCreated(event: CaseCreatedEvent) {
    return this.caseEventListener.handleCaseCreated(event);
  }

  async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
    return this.caseEventListener.handleCaseStatusChanged(event);
  }

  async handleCaseAbandoned(event: CaseAbandonedEvent) {
    return this.caseEventListener.handleCaseAbandoned(event);
  }

  async handleTaskCompleted(event: TaskCompletedEvent) {
    return this.taskEventListener.handleTaskCompleted(event);
  }

  async handleTaskAssigned(event: TaskAssignedEvent) {
    return this.taskEventListener.handleTaskAssigned(event);
  }

  async handleTaskUnassigned(event: TaskUnassignedEvent) {
    return this.taskEventListener.handleTaskUnassigned(event);
  }

  async handleSuspendCase(event: CaseSuspendedEvent) {
    this.caseEventListener.handleSuspendCase(event);
  }

  async handleGetTasksByAssignee(assignee: string) {
    return this.identityService.getTasksAssignedToUser(assignee);
  }

  async fetchFlowableTasks(caseId: number): Promise<unknown[]> {
    try {
      const processInstance = await this.processService.getProcessInstanceByBusinessKey(caseId);
      const processTasks = await this.flowableTaskService.getProcessTasks(processInstance.id);
      return processTasks;
    } catch (error) {
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      this.logger.log(`Testing connection to: ${this.flowableUrl}`, FlowableService.name);

      const response = await this.flowableClient.get(FlowableApiEndpoints.DEPLOYMENTS, {
        params: { size: 1 },
      });

      this.logger.log('Flowable health check passed', FlowableService.name);
      return { status: 'healthy' };
    } catch (error) {
      let errorMessage = `Flowable connection failed: ${error.message}`;

      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to Flowable server at ${this.flowableUrl} - server may not be running`;
      } else if (error.code === 'ECONNRESET') {
        errorMessage = `Connection reset by Flowable server at ${this.flowableUrl} - check server status and credentials`;
      } else if (error.response?.status === 401) {
        errorMessage = `Authentication failed for Flowable server - check FLOWABLE_USERNAME and FLOWABLE_PASSWORD`;
      }

      this.logger.error(`Health check failed: ${errorMessage}`, error.stack, FlowableService.name);
      throw new Error(errorMessage);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
