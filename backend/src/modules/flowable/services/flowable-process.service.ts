import { Injectable } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableApiEndpoints } from '../../../constants/flowable-api.constants';
import { FlowableVariable } from '../dto/flowable.dto';
import { FlowableClientFactory } from './flowable-client.factory';

@Injectable()
export class FlowableProcessService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

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

  async getProcessInstanceByBusinessKey(businessKey: number): Promise<{ id: string } | null> {
    const response = await this.flowableClient.get(FlowableApiEndpoints.PROCESS_INSTANCES, {
      params: {
        businessKey,
      },
    });
    return response.data.data?.[0] ?? null;
  }

  async updateProcessVariable(processInstanceId: string, variableName: string, value: any): Promise<void> {
    await this.flowableClient.put(FlowableApiEndpoints.PROCESS_INSTANCE_VARIABLE(processInstanceId, variableName), {
      name: variableName,
      value: String(value),
      type: typeof value === 'boolean' ? 'boolean' : 'string',
    });

    this.logger.log(`Updated '${variableName}' for process ${processInstanceId}`, FlowableProcessService.name);
  }

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

  private formatVariables(variables: Record<string, string>): FlowableVariable[] {
    return Object.entries(variables).map(([name, value]) => ({
      name,
      value,
      type: 'string',
    }));
  }
}
