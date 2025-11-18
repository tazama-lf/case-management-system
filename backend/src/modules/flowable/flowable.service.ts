import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData = require('form-data');
import { FlowableApiEndpoints, FlowableDefaults } from './constants/flowable-api.constants';
import { CreateFlowableTaskDto } from './dto/flowable.dto';
import { FlowableProcessService } from './services/flowable-process.service';
import { FlowableTaskService } from './services/flowable-task.service';
import { FlowableIdentityService } from './services/flowable-identity.service';
import { FlowableUtilitiesService } from './utils/flowable-utilities.service';
import { CaseEventListener } from './listeners/case-event.listener';
import { TaskEventListener } from './listeners/task-event.listener';
import { TaskAssignedEvent, TaskCreatedEvent, TaskStatusChangedEvent, TaskUnassignedEvent, BpmnTaskCreatedEvent, CaseAbandonedEvent, CaseCreatedEvent, CaseStatusChangedEvent, TaskCompletedEvent } from '../events/domain-events';

@Injectable()
export class FlowableService implements OnModuleInit {
  private flowableClient: AxiosInstance;
  private readonly flowableUrl: string;
  private readonly flowableAuth: { username: string; password: string };
  private readonly tenantId = 'c950ac85-96f0-4390-8d94-5b8fdec4e863';
  private readonly maxRetries = FlowableDefaults.MAX_RETRIES;
  private readonly retryDelayMs = FlowableDefaults.RETRY_DELAY_MS;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly processService: FlowableProcessService,
    private readonly taskService: FlowableTaskService,
    private readonly identityService: FlowableIdentityService,
    private readonly utilitiesService: FlowableUtilitiesService,
    private readonly caseEventListener: CaseEventListener,
    private readonly taskEventListener: TaskEventListener,
  ) {
    this.flowableUrl = this.configService.get<string>('FLOWABLE_URL', 'http://10.10.80.30:8081/flowable-rest');

    this.flowableAuth = {
      username: this.configService.get<string>('FLOWABLE_USERNAME', 'rest-admin'),
      password: this.configService.get<string>('FLOWABLE_PASSWORD', 'test'),
    };

    const timeoutMs = this.configService.get<number>('FLOWABLE_TIMEOUT_MS', FlowableDefaults.TIMEOUT_MS);

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
    const bpmnFilePath = path.join(process.cwd(), 'src', 'modules', 'bpmn', 'case-management.bpmn20.xml');

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

      const response = await this.flowableClient.post(FlowableApiEndpoints.DEPLOYMENTS, formData, {
        headers,
        params: {
          tenantId: this.tenantId,
        },
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

  /**
   * Ensure a user is a member of a Flowable identity group
   */
  async addUserToGroup(groupId: string, userId: string) {
    return this.identityService.addUserToGroup(this.flowableClient, groupId, userId);
  }

  /**
   * Remove a user from a Flowable identity group
   */
  async removeUserFromGroup(groupId: string, userId: string) {
    return this.identityService.removeUserFromGroup(this.flowableClient, groupId, userId);
  }

  async createGroup(groupData: { id: string; name: string; type: string }) {
    return this.identityService.createGroup(this.flowableClient, groupData);
  }

  async getGroup(groupId: string) {
    return this.identityService.getGroup(this.flowableClient, groupId);
  }

  async startProcessInstance(processDefinitionKey: string, variables: Record<string, string>, businessKey: string) {
    return this.processService.startProcessInstance(
      this.flowableClient,
      this.tenantId,
      processDefinitionKey,
      variables,
      businessKey,
    );
  }

  async getProcessInstance(processInstanceId: string) {
    return this.processService.getProcessInstance(this.flowableClient, processInstanceId);
  }

  async getProcessInstanceByBusinessKey(businessKey: string) {
    return this.processService.getProcessInstanceByBusinessKey(this.flowableClient, businessKey);
  }

  async getProcessTasks(processInstanceId: string) {
    return this.taskService.getProcessTasks(this.flowableClient, processInstanceId);
  }

  async createTask(taskData: CreateFlowableTaskDto) {
    return this.taskService.createTask(this.flowableClient, taskData);
  }

  async completeTask(taskId: string, variables?: Record<string, string>) {
    return this.taskService.completeTask(this.flowableClient, taskId, variables);
  }

  async claimTask(taskId: string, userId: string): Promise<void> {
    return this.taskService.claimTask(this.flowableClient, taskId, userId);
  }

  async unclaimTask(taskId: string): Promise<void> {
    return this.taskService.unclaimTask(this.flowableClient, taskId);
  }

  async delegateTask(taskId: string, userId: string): Promise<void> {
    return this.taskService.delegateTask(this.flowableClient, taskId, userId);
  }

  async assignTaskToCandidateGroup(taskId: string, group: string) {
    return this.taskService.assignTaskToCandidateGroup(this.flowableClient, taskId, group);
  }

  async getTaskIdentityLinks(taskId: string) {
    return this.taskService.getTaskIdentityLinks(this.flowableClient, taskId);
  }

  async getCandidateGroupTasks(candidateGroup: string, includeVariables: boolean = true) {
    return this.taskService.getCandidateGroupTasks(this.flowableClient, candidateGroup, includeVariables);
  }

  async getUserTasks(assignee: string, includeVariables: boolean = true) {
    return this.taskService.getUserTasks(this.flowableClient, assignee, includeVariables);
  }

  async updateProcessVariable(processInstanceId: string, variableName: string, value: any): Promise<void> {
    return this.processService.updateProcessVariable(this.flowableClient, processInstanceId, variableName, value);
  }

  async setProcessVariables(processInstanceId: string, variables: Record<string, string>) {
    return this.processService.setProcessVariables(this.flowableClient, processInstanceId, variables);
  }

  async getTenantTasks(
    tenantId: string,
    filters?: {
      candidateGroup?: string;
      assignee?: string;
      unassigned?: boolean;
    },
  ) {
    return this.taskService.getTenantTasks(this.flowableClient, tenantId, filters);
  }

  async getTask(taskId: string) {
    return this.taskService.getTask(this.flowableClient, taskId);
  }

  async setTaskVariables(taskId: string, variables: Record<string, string>) {
    return this.taskService.setTaskVariables(this.flowableClient, taskId, variables);
  }

  async getTaskVariables(taskId: string): Promise<Record<string, string>> {
    return this.utilitiesService.getTaskVariables(this.flowableClient, taskId);
  }

  async updateTaskVariable(taskId: string, variableName: string, value: string) {
    return this.taskService.updateTaskVariable(this.flowableClient, taskId, variableName, value);
  }

  async deleteTaskVariable(taskId: string, variableName: string) {
    return this.taskService.deleteTaskVariable(this.flowableClient, taskId, variableName);
  }

  async terminateProcessInstance(processInstanceId: string, reason?: string) {
    return this.processService.terminateProcessInstance(this.flowableClient, processInstanceId, reason);
  }

  async suspendProcessInstance(processInstanceId: string) {
    return this.processService.suspendProcessInstance(this.flowableClient, processInstanceId);
  }

  async activateProcessInstance(processInstanceId: string) {
    return this.processService.activateProcessInstance(this.flowableClient, processInstanceId);
  }

  async getWorkQueueStatistics(candidateGroup?: string) {
    return this.identityService.getWorkQueueStatistics(
      this.flowableClient,
      (group: string, includeVariables: boolean) => this.getCandidateGroupTasks(group, includeVariables),
      candidateGroup,
    );
  }

  async getAllCandidateGroups() {
    return this.identityService.getAllCandidateGroups(this.flowableClient);
  }

  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      await this.flowableClient.get(FlowableApiEndpoints.DEPLOYMENTS, {
        params: { size: 1 },
      });
      return { status: 'healthy' };
    } catch (error) {
      throw new Error(`Flowable connection failed: ${error.message}`);
    }
  }

  async getProcessDefinitions(processDefinitionKey?: string) {
    return this.processService.getProcessDefinitions(this.flowableClient, this.tenantId, processDefinitionKey);
  }

  async listProcessDefinitions(): Promise<string> {
    return this.processService.listProcessDefinitions(this.flowableClient, this.tenantId);
  }

  /* Event Handlers to delegate to listeners */

  async handleCaseCreated(event: CaseCreatedEvent) {
    this.caseEventListener.handleCaseCreated(event);
  }

  async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
    this.caseEventListener.handleCaseStatusChanged(event);
  }

  async handleCaseAbandoned(event: CaseAbandonedEvent) {
    this.caseEventListener.handleCaseAbandoned(event);
  }

  async handleTaskCreated(event: TaskCreatedEvent) {
    this.taskEventListener.handleTaskCreated(event);
  }

  async handleTaskStatusChanged(event: TaskStatusChangedEvent) {
    this.taskEventListener.handleTaskStatusChanged(event);
  }

  async handleTaskCompleted(event: TaskCompletedEvent) {
    this.taskEventListener.handleTaskCompleted(event);
  }

  async handleTaskAssigned(event: TaskAssignedEvent) {
    this.taskEventListener.handleTaskAssigned(event);
  }

  async handleTaskUnassigned(event: TaskUnassignedEvent) {
    this.taskEventListener.handleTaskUnassigned(event);
  }

  async handleBpmnTaskCreated(event: BpmnTaskCreatedEvent) {
    this.taskEventListener.handleBpmnTaskCreated(event);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
