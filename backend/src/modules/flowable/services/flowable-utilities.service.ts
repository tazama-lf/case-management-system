import { Injectable } from '@nestjs/common';
import { FlowableApiEndpoints } from '../../../constants/flowable-api.constants';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';
import { FlowableClientFactory } from './flowable-client.factory';

@Injectable()
export class FlowableUtilitiesService {
  private readonly flowableClient: AxiosInstance;

  constructor(
    private readonly logger: LoggerService,
    private readonly clientFactory: FlowableClientFactory,
  ) {
    this.flowableClient = this.clientFactory.getClient();
  }

  /**
   * Get all variables for a task
   * @param taskId Flowable task ID
   * @returns Record of variable names to values
   */
  async getTaskVariables(taskId: number): Promise<Record<string, unknown>> {
    try {
      const response = await this.flowableClient.get(FlowableApiEndpoints.TASK_VARIABLES(taskId));

      const variables: Record<string, unknown> = {};
      if (Array.isArray(response.data)) {
        response.data.forEach((variable: unknown) => {
          const varObj = variable as Record<string, unknown>;
          variables[varObj.name as string] = varObj.value as string;
        });
      }

      return variables;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get task variables: ${errorMessage}`, errorStack, FlowableUtilitiesService.name);
      return {};
    }
  }
}
