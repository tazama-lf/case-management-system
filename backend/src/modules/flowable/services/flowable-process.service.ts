import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints, FlowableTaskActions } from '../../../constants/flowable-api.constants';
import { FlowableVariable } from '../dto/flowable.dto';
import { FlowableClientFactory } from './flowable-client.factory';

/**
 * Service responsible for Flowable process instance operations
 * Handles starting, querying, updating, and managing process instances
 */
@Injectable()
export class FlowableProcessService {
  private readonly flowableClient: AxiosInstance;
  // private readonly tenantId: string;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
    // this.tenantId = this.clientFactory.tenantId;
  }

  /**
   * Start a new process instance
   */
  async startProcessInstance(
    processDefinitionKey: string,
    variables: Record<string, any>,
    businessKey: number,
    tenantId?: string,
  ): Promise<{ id: string }> {
    this.logger.log(`Start - Start Process Instance With BusinessKey: ${businessKey}`, FlowableProcessService.name);
    const formattedVariables = this.formatVariables(variables);
    const payload = {
      processDefinitionKey,
      variables: formattedVariables,
      businessKey,
    };

    const response = await this.flowableClient.post(FlowableApiEndpoints.PROCESS_INSTANCES, payload);

    this.logger.log(`End - Start Process Instance With BusinessKey: ${businessKey}`, FlowableProcessService.name);
    return response.data;
  }

  /**
   * Get a process instance by ID
   */
  async getProcessInstance(processInstanceId: string): Promise<unknown> {
    const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId));
    return response.data;
  }

  /**
   * Get a process instance by business key
   */
  async getProcessInstanceByBusinessKey(businessKey: number): Promise<{ id: string } | null> {
    const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_INSTANCES, {
      params: {
        businessKey,
      },
    });
    return response.data.data?.[0] ?? null;
  }

  /**
   * Update a single process variable
   */
  async updateProcessVariable(processInstanceId: string, variableName: string, value: any): Promise<void> {
    await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLE(processInstanceId, variableName), {
      name: variableName,
      value: String(value),
      type: typeof value === 'boolean' ? 'boolean' : 'string',
    });

    this.logger.log(`Updated '${variableName}' for process ${processInstanceId}`, FlowableProcessService.name);
  }

  /**
   * Set multiple process variables at once
   */
  async setProcessVariables(processInstanceId: string, variables: Record<string, string>): Promise<unknown> {
    try {
      const formattedVariables = this.formatVariables(variables);

      const response = await this.flowableClient.put(
        FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLES(processInstanceId),
        formattedVariables,
      );

      this.logger.log(`Variables updated successfully for process ${processInstanceId}`, FlowableProcessService.name);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to set process variables: ${errorMessage}`, errorStack, FlowableProcessService.name);
      throw new HttpException('Failed to set process variables', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Terminate a process instance
   */
  async terminateProcessInstance(processInstanceId: string, reason?: string): Promise<unknown> {
    const payload = {
      action: 'delete',
      deleteReason: reason ?? 'Process terminated by system',
    };

    const response = await this.flowableClient.delete(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId), {
      data: payload,
    });

    this.logger.log(`Process instance terminated: ${processInstanceId}`, FlowableProcessService.name);
    return response.data;
  }

  /**
   * Suspend a process instance
   */
  async suspendProcessInstance(processInstanceId: string): Promise<unknown> {
    const payload = {
      action: FlowableTaskActions.SUSPEND,
    };

    const response = await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId), payload);

    this.logger.log(`Process instance suspended: ${processInstanceId}`, FlowableProcessService.name);
    return response.data;
  }

  /**
   * Activate a process instance
   */
  async activateProcessInstance(processInstanceId: string): Promise<unknown> {
    const payload = {
      action: FlowableTaskActions.ACTIVATE,
    };

    const response = await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId), payload);

    this.logger.log(`Process instance activated: ${processInstanceId}`, FlowableProcessService.name);
    return response.data;
  }

  /**
   * Get process definitions
   */
  async getProcessDefinitions(processDefinitionKey?: string, tenantId?: string) {
    const params: Record<string, unknown> = {};
    if (processDefinitionKey) {
      params.key = processDefinitionKey;
    }
    params.tenantId = tenantId;

    const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_DEFINITIONS, {
      params,
    });
    return response.data.data ?? [];
  }

  /**
   * List all process definition keys
   */
  async listProcessDefinitions(): Promise<string> {
    const definitions = await this.getProcessDefinitions();
    return definitions.map((def: any) => def.key).join(', ');
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
        value,
        type: 'string',
      };
    });
  }
}
