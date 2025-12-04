import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData = require('form-data');
import { FlowableApiEndpoints, FlowableDefaults } from '../../constants/flowable-api.constants';
import { CreateFlowableTaskDto } from '../../dtos/flowable/flowable.dto';
import { FlowableProcessService } from './services/flowable-process.service';
import { FlowableTaskService } from './services/flowable-task.service';
import { FlowableIdentityService } from './services/flowable-identity.service';
import { FlowableUtilitiesService } from './services/flowable-utilities.service';
import { FlowableClientFactory } from './services/flowable-client.factory';
import { CaseEventListener } from './listeners/case-event.listener';
import { TaskEventListener } from './listeners/task-event.listener';
import {
  TaskAssignedEvent,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskUnassignedEvent,
  BpmnTaskCreatedEvent,
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
  private readonly tenantId: string;
  private readonly maxRetries = FlowableDefaults.MAX_RETRIES;
  private readonly retryDelayMs = FlowableDefaults.RETRY_DELAY_MS;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
    private readonly processService: FlowableProcessService,
    private readonly taskService: FlowableTaskService,
    private readonly identityService: FlowableIdentityService,
    private readonly utilitiesService: FlowableUtilitiesService,
    private readonly caseEventListener: CaseEventListener,
    private readonly taskEventListener: TaskEventListener,
  ) {
    this.flowableClient = this.clientFactory.getClient();
    this.flowableUrl = this.clientFactory.getBaseUrl();
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

  /**
   * Ensure a user is a member of a Flowable identity group
   */
  async addUserToGroup(groupId: string, userId: string) {
    return this.identityService.addUserToGroup(groupId, userId);
  }

  /**
   * Remove a user from a Flowable identity group
   */
  async removeUserFromGroup(groupId: string, userId: string) {
    return this.identityService.removeUserFromGroup(groupId, userId);
  }

  async createGroup(groupData: { id: string; name: string; type: string }) {
    return this.identityService.createGroup(groupData);
  }

  async getGroup(groupId: string) {
    return this.identityService.getGroup(groupId);
  }

  async startProcessInstance(processDefinitionKey: string, variables: Record<string, string>, businessKey: string, tenantId?: string) {
    return this.processService.startProcessInstance(processDefinitionKey, variables, businessKey, tenantId);
  }

  async getProcessInstance(processInstanceId: string) {
    return this.processService.getProcessInstance(processInstanceId);
  }

  async getProcessInstanceByBusinessKey(businessKey: string) {
    return this.processService.getProcessInstanceByBusinessKey(businessKey);
  }

  async getProcessTasks(processInstanceId: string) {
    return this.taskService.getProcessTasks(processInstanceId);
  }

  async createTask(taskData: CreateFlowableTaskDto) {
    return this.taskService.createTask(taskData);
  }

  async completeTask(taskId: string, variables?: Record<string, string>) {
    return this.taskService.completeTask(taskId, variables);
  }

  async claimTask(taskId: string, userId: string): Promise<void> {
    return this.taskService.claimTask(taskId, userId);
  }

  async unclaimTask(taskId: string): Promise<void> {
    return this.taskService.unclaimTask(taskId);
  }

  async delegateTask(taskId: string, userId: string): Promise<void> {
    return this.taskService.delegateTask(taskId, userId);
  }

  async assignTaskToCandidateGroup(taskId: string, group: string) {
    return this.taskService.assignTaskToCandidateGroup(taskId, group);
  }

  async getTaskIdentityLinks(taskId: string) {
    return this.taskService.getTaskIdentityLinks(taskId);
  }

  async getCandidateGroupTasks(candidateGroup: string, includeVariables: boolean = true) {
    return this.taskService.getCandidateGroupTasks(candidateGroup, includeVariables);
  }

  async getUserTasks(assignee: string, includeVariables: boolean = true) {
    return this.taskService.getUserTasks(assignee, includeVariables);
  }

  async updateProcessVariable(processInstanceId: string, variableName: string, value: any): Promise<void> {
    return this.processService.updateProcessVariable(processInstanceId, variableName, value);
  }

  async setProcessVariables(processInstanceId: string, variables: Record<string, string>) {
    return this.processService.setProcessVariables(processInstanceId, variables);
  }

  // async getTenantTasks(
  //   tenantId: string,
  //   filters?: {
  //     candidateGroup?: string;
  //     assignee?: string;
  //     unassigned?: boolean;
  //   },
  // ) {
  //   return this.taskService.getTenantTasks(filters);
  // }

  async getTask(taskId: string) {
    return this.taskService.getTask(taskId);
  }

  async setTaskVariables(taskId: string, variables: Record<string, string>) {
    return this.taskService.setTaskVariables(taskId, variables);
  }

  async getTaskVariables(taskId: string): Promise<Record<string, string>> {
    return this.utilitiesService.getTaskVariables(taskId);
  }

  async updateTaskVariable(taskId: string, variableName: string, value: string) {
    return this.taskService.updateTaskVariable(taskId, variableName, value);
  }

  async deleteTaskVariable(taskId: string, variableName: string) {
    return this.taskService.deleteTaskVariable(taskId, variableName);
  }

  async terminateProcessInstance(processInstanceId: string, reason?: string) {
    return this.processService.terminateProcessInstance(processInstanceId, reason);
  }

  async suspendProcessInstance(processInstanceId: string) {
    return this.processService.suspendProcessInstance(processInstanceId);
  }

  async activateProcessInstance(processInstanceId: string) {
    return this.processService.activateProcessInstance(processInstanceId);
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
    return this.processService.getProcessDefinitions(processDefinitionKey);
  }

  async listProcessDefinitions(): Promise<string> {
    return this.processService.listProcessDefinitions();
  }

  /* Event Handlers to delegate to listeners */

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
