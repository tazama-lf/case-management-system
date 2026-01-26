import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints } from '../../../constants/flowable-api.constants';
import { FlowableClientFactory } from './flowable-client.factory';
import { formatVariables } from '../utils/formatVariables';

@Injectable()
export class FlowableProcessService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  async startProcessInstance(processDefinitionKey: string, variables: Record<string, any>, businessKey: number, tenantId?: string) {
    this.logger.log(`Start - Start Process Instance With BusinessKey: ${businessKey}`, FlowableProcessService.name);
    try {
      const formattedVariables = formatVariables(variables);
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

  async getProcessInstanceByBusinessKey(businessKey: number) {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_INSTANCES, {
        params: {
          businessKey,
        },
      });

      if (!response || response.data.data.length == 0) {
        this.logger.log(`No process instance found with business key: ${businessKey}`, FlowableProcessService.name);
        throw new NotFoundException(`No process instance found with business key: ${businessKey}`);
      }

      return response.data.data[0];
    } catch (error) {
      throw error;
    }
  }

  async updateProcessVariable(businessKey: number, variableName: string, value: unknown): Promise<void> {
    try {
      const processInstance = await this.getProcessInstanceByBusinessKey(businessKey);

      if (!processInstance) {
        this.logger.warn(`No Flowable process found for case ${businessKey}`, FlowableProcessService.name);
        throw new NotFoundException('Process instance not found');
      }

      await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLE(processInstance.id, variableName), {
        name: variableName,
        value: String(value),
        type: typeof value === 'boolean' ? 'boolean' : 'string',
      });
    } catch (error) {
      throw new HttpException(`Failed to update process variable: ${variableName}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // async setProcessVariables(processInstanceId: string, variables: Record<string, string>) {
  //   try {
  //     const formattedVariables = formatVariables(variables);

  //     const response = await this.flowableClient.put(
  //       FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLES(processInstanceId),
  //       formattedVariables,
  //     );

  //     this.logger.log(`Variables updated successfully for process ${processInstanceId}`, FlowableProcessService.name);
  //     return response.data;
  //   } catch (error) {
  //     this.logger.error(`Failed to set process variables: ${error.message}`, error.stack, FlowableProcessService.name);

  //     if (error.response) {
  //       this.logger.error(`Flowable API error response: ${JSON.stringify(error.response.data)}`, FlowableProcessService.name);
  //       this.logger.error(`Status code: ${error.response.status}`, FlowableProcessService.name);
  //     }

  //     if (error.response?.status === 409) {
  //       this.logger.warn('Conflict detected, attempting to update variables individually', FlowableProcessService.name);

  //       try {
  //         for (const [name, value] of Object.entries(variables)) {
  //           await this.updateProcessVariable(processInstanceId, name, value);
  //         }
  //         this.logger.log(`Successfully updated all variables individually for process ${processInstanceId}`, FlowableProcessService.name);
  //         return;
  //       } catch (retryError) {
  //         this.logger.error(
  //           `Failed to update variables individually: ${retryError.message}`,
  //           retryError.stack,
  //           FlowableProcessService.name,
  //         );
  //         throw new HttpException('Failed to set process variables', HttpStatus.INTERNAL_SERVER_ERROR);
  //       }
  //     }

  //     throw new HttpException('Failed to set process variables', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }

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
}
