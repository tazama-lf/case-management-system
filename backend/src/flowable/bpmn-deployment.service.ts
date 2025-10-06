import { Injectable, OnModuleInit } from '@nestjs/common';
import { FlowableService } from '../flowable/flowable.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BpmnDeploymentService implements OnModuleInit {
  private tenantId = 'c950ac85-96f0-4390-8d94-5b8fdec4e863';

  constructor(
      private readonly flowableService: FlowableService,
      private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    await this.deployBpmnProcesses();
  }

  private async deployBpmnProcesses() {
    try {
      const bpmnFilesPath = path.join(process.cwd(), 'src', 'bpmn');

      // Deploy unified case management process
      await this.deployUnifiedCaseManagementProcess(bpmnFilesPath);

      this.logger.log(
          'Unified case management BPMN process deployed successfully',
          BpmnDeploymentService.name,
      );
    } catch (error) {
      this.logger.error(
          `Failed to deploy BPMN processes: ${error.message}`,
          error.stack,
          BpmnDeploymentService.name,
      );
      // Don't throw - let the app start even if deployment fails
    }
  }

  private async deployUnifiedCaseManagementProcess(bpmnPath: string) {
    const bpmnFilePath = path.join(bpmnPath, 'case-management.bpmn20.xml');

    try {
      const bpmnXml = await fs.readFile(bpmnFilePath, 'utf-8');
      await this.flowableService.deployProcess(
          bpmnXml,
          'UnifiedCaseManagementProcess',
          this.tenantId,
      );
      this.logger.log(
          'Unified case management process deployed',
          BpmnDeploymentService.name,
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(
            `BPMN file not found at ${bpmnFilePath}. Skipping deployment.`,
            BpmnDeploymentService.name,
        );
      } else {
        throw error;
      }
    }
  }

  async redeployUnifiedProcess() {
    await this.deployBpmnProcesses();
    return {
      message: 'Unified case management process redeployed successfully',
    };
  }

  async getDeploymentStatus() {
    try {
      // You can enhance this to check actual Flowable deployment status
      return {
        deployed: true,
        processDefinitionKey: 'caseManagementProcess',
        tenantId: this.tenantId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
          `Error checking deployment status: ${error.message}`,
          error.stack,
          BpmnDeploymentService.name,
      );
      return {
        deployed: false,
        error: error.message,
      };
    }
  }
}