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
  async startProcessInstance(processDefinitionKey: string, variables: Record<string, any>, businessKey: number, tenantId?: string) {
    this.logger.log(`Start - Start Process Instance With BusinessKey: ${businessKey}`, FlowableProcessService.name);
    try {
      const formattedVariables = this.formatVariables(variables);
      const payload = {
        processDefinitionKey,
        variables: formattedVariables,
        businessKey,
      };

      const response = await this.flowableClient.post(FlowableApiEndpoints.PROCESS_INSTANCES, payload);

      this.logger.log(`End - Start Process Instance With BusinessKey: ${businessKey}`, FlowableProcessService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to start process instance: ${error.message}`, error.stack, FlowableProcessService.name);
      throw new HttpException('Failed to start process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a process instance by ID
   */
  async getProcessInstance(processInstanceId: string) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId));
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Failed to get process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get a process instance by business key
   */
  async getProcessInstanceByBusinessKey(businessKey: number) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_INSTANCES, {
        params: {
          businessKey,
        },
      });
      return response.data.data?.[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get process by business key: ${error.message}`, error.stack, FlowableProcessService.name);
      return null;
    }
  }

  /**
   * Update a single process variable
   */
  async updateProcessVariable(processInstanceId: string, variableName: string, value: any): Promise<void> {
    try {
      await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLE(processInstanceId, variableName), {
        name: variableName,
        value: String(value),
        type: typeof value === 'boolean' ? 'boolean' : 'string',
      });

      this.logger.log(`Updated '${variableName}' for process ${processInstanceId}`, FlowableProcessService.name);
    } catch (error) {
      this.logger.error(`Failed to update variable '${variableName}': ${error.message}`, error.stack, FlowableProcessService.name);
      throw new HttpException(`Failed to update process variable: ${variableName}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Set multiple process variables at once
   */
  async setProcessVariables(processInstanceId: string, variables: Record<string, string>) {
    try {
      const formattedVariables = this.formatVariables(variables);

      const response = await this.flowableClient.put(
        FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLES(processInstanceId),
        formattedVariables,
      );

      this.logger.log(`Variables updated successfully for process ${processInstanceId}`, FlowableProcessService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to set process variables: ${error.message}`, error.stack, FlowableProcessService.name);

      if (error.response) {
        this.logger.error(`Flowable API error response: ${JSON.stringify(error.response.data)}`, FlowableProcessService.name);
        this.logger.error(`Status code: ${error.response.status}`, FlowableProcessService.name);
      }

      if (error.response?.status === 409) {
        this.logger.warn('Conflict detected, attempting to update variables individually', FlowableProcessService.name);

        try {
          for (const [name, value] of Object.entries(variables)) {
            await this.updateProcessVariable(processInstanceId, name, value);
          }
          this.logger.log(`Successfully updated all variables individually for process ${processInstanceId}`, FlowableProcessService.name);
          return;
        } catch (retryError) {
          this.logger.error(
            `Failed to update variables individually: ${retryError.message}`,
            retryError.stack,
            FlowableProcessService.name,
          );
          throw new HttpException('Failed to set process variables', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      throw new HttpException('Failed to set process variables', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Terminate a process instance
   */
  async terminateProcessInstance(processInstanceId: string, reason?: string) {
    try {
      const payload = {
        action: 'delete',
        deleteReason: reason || 'Process terminated by system',
      };

      const response = await this.flowableClient.delete(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId), {
        data: payload,
      });

      this.logger.log(`Process instance terminated: ${processInstanceId}`, FlowableProcessService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to terminate process instance: ${error.message}`, error.stack, FlowableProcessService.name);
      throw new HttpException('Failed to terminate process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Suspend a process instance
   */
  async suspendProcessInstance(processInstanceId: string) {
    try {
      const payload = {
        action: FlowableTaskActions.SUSPEND,
      };

      const response = await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId), payload);

      this.logger.log(`Process instance suspended: ${processInstanceId}`, FlowableProcessService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to suspend process instance: ${error.message}`, error.stack, FlowableProcessService.name);
      throw new HttpException('Failed to suspend process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Activate a process instance
   */
  async activateProcessInstance(processInstanceId: string) {
    try {
      const payload = {
        action: FlowableTaskActions.ACTIVATE,
      };

      const response = await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE(processInstanceId), payload);

      this.logger.log(`Process instance activated: ${processInstanceId}`, FlowableProcessService.name);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to activate process instance: ${error.message}`, error.stack, FlowableProcessService.name);
      throw new HttpException('Failed to activate process instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get process definitions
   */
  async getProcessDefinitions(processDefinitionKey?: string, tenantId?: string) {
    try {
      const params: Record<string, unknown> = {};
      if (processDefinitionKey) {
        params.key = processDefinitionKey;
      }
      params.tenantId = tenantId;

      const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_DEFINITIONS, {
        params,
      });
      return response.data.data || [];
    } catch (error) {
      this.logger.error(`Failed to get process definitions: ${error.message}`, error.stack, FlowableProcessService.name);
      return [];
    }
  }

  /**
   * List all process definition keys
   */
  async listProcessDefinitions(): Promise<string> {
    try {
      const definitions = await this.getProcessDefinitions();
      return definitions.map((def: any) => def.key).join(', ');
    } catch (error) {
      return 'Unable to list process definitions';
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
