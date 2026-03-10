import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- form-data requires CommonJS import syntax
import FormData = require('form-data');
import { FlowableApiEndpoints, FlowableDefaults } from '../../constants/flowable-api.constants';
import { FlowableProcessService } from './services/flowable-process.service';
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
} from '../events/domain-events';
import { setTimeout as sleep } from 'node:timers/promises';

@Injectable()
export class FlowableService implements OnModuleInit {
  private readonly flowableClient: AxiosInstance;
  private readonly flowableUrl: string;
  private readonly maxRetries = FlowableDefaults.MAX_RETRIES;
  private readonly retryDelayMs = FlowableDefaults.RETRY_DELAY_MS;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
    private readonly flowableProcessService: FlowableProcessService,
    private readonly caseEventListener: CaseEventListener,
    private readonly taskEventListener: TaskEventListener,
  ) {
    this.flowableClient = this.clientFactory.getClient();
    this.flowableUrl = this.clientFactory.getBaseUrl();
  }

  async onModuleInit(): Promise<void> {
    const flowableEnabled = this.configService.get<boolean>('FLOWABLE_ENABLED', true);

    if (!flowableEnabled) {
      this.loggerService.log('Flowable is disabled via configuration, skipping initialization', FlowableService.name);
      return;
    }

    this.loggerService.log(`Attempting to connect to Flowable at: ${this.flowableUrl}`, FlowableService.name);

    /* eslint-disable no-await-in-loop -- Retry logic requires sequential execution with delays between attempts */
    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        this.loggerService.log(`Initializing Flowable (attempt ${attempt}/${this.maxRetries})`, FlowableService.name);

        await this.healthCheck();
        await this.deployBpmnProcess();

        this.loggerService.log('Flowable initialized successfully', FlowableService.name);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.loggerService.error(
          `Failed to initialize Flowable (attempt ${attempt}/${this.maxRetries}): ${errorMessage}`,
          errorStack,
          FlowableService.name,
        );

        if (attempt === this.maxRetries) {
          // Make this a warning instead of error to allow application to start
          const skipOnFailure = this.configService.get<boolean>('FLOWABLE_SKIP_ON_FAILURE', false);

          if (skipOnFailure) {
            this.loggerService.warn(
              `Flowable initialization failed after ${this.maxRetries} attempts. Continuing without Flowable as FLOWABLE_SKIP_ON_FAILURE=true`,
              FlowableService.name,
            );
            return;
          } else {
            this.loggerService.error('Max retry attempts reached. CMS cannot start without Flowable.', errorStack, FlowableService.name);
            throw new Error(`Flowable initialization failed after ${this.maxRetries} attempts: ${errorMessage}`, { cause: error });
          }
        }

        this.loggerService.log(`Retrying Flowable initialization in ${this.retryDelayMs / 1000} seconds...`, FlowableService.name);
        await this.sleep(this.retryDelayMs);
      }
    }
    /* eslint-enable no-await-in-loop */
  }

  private async deployBpmnProcess() {
    const bpmnFilePath = path.join(process.cwd(), 'src', 'modules', 'bpmn', 'cms.bpmn20.xml');

    try {
      this.loggerService.log('Deploying BPMN process', FlowableService.name);

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

      this.loggerService.log(`BPMN process deployed successfully: ${response.data.id}`, FlowableService.name);
      return response.data;
    } catch (error) {
      const errorCode = (error as unknown as { code?: string }).code;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      if (errorCode === 'ENOENT') {
        this.loggerService.error(
          `BPMN file not found at ${bpmnFilePath}. Cannot start CMS without BPMN process.`,
          errorStack,
          FlowableService.name,
        );
        throw new Error(`Critical: BPMN file not found at ${bpmnFilePath}`, { cause: error });
      }

      this.loggerService.error(`Failed to deploy BPMN process: ${errorMessage}`, errorStack, FlowableService.name);
      throw new HttpException('Failed to deploy BPMN process', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async startProcessInstance(
    processDefinitionKey: string,
    variables: Record<string, string>,
    businessKey: number,
    tenantId?: string,
  ): Promise<unknown> {
    return await this.flowableProcessService.startProcessInstance(processDefinitionKey, variables, businessKey, tenantId);
  }

  async healthCheck(): Promise<{ status: string; message?: string }> {
    try {
      this.loggerService.log(`Testing connection to: ${this.flowableUrl}`, FlowableService.name);

      await this.flowableClient.get(FlowableApiEndpoints.DEPLOYMENTS, {
        params: { size: 1 },
      });

      this.loggerService.log('Flowable health check passed', FlowableService.name);
      return { status: 'healthy' };
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorCode = (error as unknown as { code?: string }).code;

      if (errorCode === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to Flowable server at ${this.flowableUrl} - server may not be running`;
      } else if (errorCode === 'ECONNRESET') {
        errorMessage = `Connection reset by Flowable server at ${this.flowableUrl} - check server status and credentials`;
      }
      this.loggerService.error(`Health check failed: ${errorMessage}`, errorStack, FlowableService.name);
      throw new Error(errorMessage, { cause: error });
    }
  }

  async handleCaseCreated(event: CaseCreatedEvent): Promise<void> {
    this.loggerService.log(`Start - Process CaseID: ${event.caseId}`, CaseEventListener.name);

    const processInstance = await this.flowableProcessService.startProcessInstance(
      'caseManagementProcess',
      {
        caseId: String(event.caseId),
        tenantId: event.tenantId,
        creationType: event.creationType,
        caseStatus: event.caseStatus,
        creatorRole: event.creatorRole,
        isReopened: String(event.isReopened),
        isFraudNAML: String(event.isFraudNAML),
        // Required BPMN variables with safe defaults
        readyForAssignment: 'true',
        // Investigation action variables with defaults
        investigationAction: 'pending',
        // Additional required variables
        investigationNotes: '',
        finalOutcome: 'PENDING_INVESTIGATION',
      },
      event.caseId,
      event.tenantId,
    );

    this.loggerService.log(`End - Started process ${processInstance.id} for case ${event.caseId}`, CaseEventListener.name);
  }

  async handleCaseStatusChanged(event: CaseStatusChangedEvent): Promise<void> {
    await this.caseEventListener.handleCaseStatusChanged(event);
  }

  async handleCaseAbandoned(event: CaseAbandonedEvent): Promise<void> {
    await this.caseEventListener.handleCaseAbandoned(event);
  }

  async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    await this.taskEventListener.handleTaskCompleted(event);
  }

  async handleTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    await this.taskEventListener.handleTaskAssigned(event);
  }

  async handleTaskUnassigned(event: TaskUnassignedEvent): Promise<void> {
    await this.taskEventListener.handleTaskUnassigned(event);
  }

  private async sleep(ms: number): Promise<void> {
    await sleep(ms);
  }
}
