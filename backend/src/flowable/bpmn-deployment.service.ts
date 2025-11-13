import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from './flowable.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BpmnDeploymentService implements OnModuleInit {
  constructor(
    private readonly flowableService: FlowableService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.deployUnifiedCaseManagementProcess();
    } catch (error) {
      this.logger.error(`Failed to deploy BPMN processes: ${error.message}`, error.stack, BpmnDeploymentService.name);
    }
  }

  async deployUnifiedCaseManagementProcess(): Promise<void> {
    try {
      const bpmnPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');
      const bpmnContent = await fs.readFile(bpmnPath, 'utf-8');

      const result = await this.flowableService.deployProcess(
        bpmnContent,
        'UnifiedCaseManagementProcess',
        'c950ac85-96f0-4390-8d94-5b8fdec4e863', // Default tenant ID
      );

      this.logger.log('Unified case management process deployed', BpmnDeploymentService.name);
      this.logger.log('Unified case management BPMN process deployed successfully', BpmnDeploymentService.name);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const bpmnPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');
        this.logger.warn(`BPMN file not found at ${bpmnPath}. Skipping deployment.`, BpmnDeploymentService.name);
        return;
      }
      throw error;
    }
  }

  async redeployUnifiedProcess(): Promise<{ message: string }> {
    try {
      await this.deployUnifiedCaseManagementProcess();
      return {
        message: 'Unified case management process redeployed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to deploy BPMN processes: ${error.message}`, error.stack, BpmnDeploymentService.name);
      throw error;
    }
  }

  async getDeploymentStatus(): Promise<{
    deployed: boolean;
    processDefinitionKey: string;
    tenantId: string;
    timestamp: Date;
  }> {
    return {
      deployed: true,
      processDefinitionKey: 'caseManagementProcess',
      tenantId: 'c950ac85-96f0-4390-8d94-5b8fdec4e863',
      timestamp: new Date(),
    };
  }
}
