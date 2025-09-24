import { Injectable, OnModuleInit } from '@nestjs/common';
import { FlowableService } from '../flowable/flowable.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BpmnDeploymentService implements OnModuleInit {
  constructor(
    private readonly flowableService: FlowableService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    await this.deployBpmnProcesses();
  }

  private async deployBpmnProcesses() {
    try {
      // Path to your BPMN files (adjust as needed)
      const bpmnFilesPath = path.join(process.cwd(), 'src', 'bpmn');

      // Deploy case creation process
      await this.deployCaseCreationProcess(bpmnFilesPath);

      // Deploy case closure approval process
      await this.deployCaseClosureApprovalProcess(bpmnFilesPath);

      this.logger.log('All BPMN processes deployed successfully', BpmnDeploymentService.name);
    } catch (error) {
      this.logger.error(`Failed to deploy BPMN processes: ${error.message}`, error.stack, BpmnDeploymentService.name);
      // Don't throw here - let the app start even if deployment fails
    }
  }

  private async deployCaseCreationProcess(bpmnPath: string) {
    const bpmnFilePath = path.join(bpmnPath, 'case-creation.bpmn20.xml');
    try {
      const bpmnXml = await fs.readFile(bpmnFilePath, 'utf-8');
      await this.flowableService.deployProcess(bpmnXml, 'CaseCreationProcess');
      this.logger.log('Case creation process deployed', BpmnDeploymentService.name);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`BPMN file not found at ${bpmnFilePath}. Skipping deployment.`, BpmnDeploymentService.name);
      } else {
        throw error;
      }
    }
  }

  private async deployCaseClosureApprovalProcess(bpmnPath: string) {
    const bpmnFilePath = path.join(bpmnPath, 'case-closure-approval.bpmn20.xml');
    try {
      const bpmnXml = await fs.readFile(bpmnFilePath, 'utf-8');
      await this.flowableService.deployProcess(bpmnXml, 'CaseClosureApprovalProcess');
      this.logger.log('Case closure approval process deployed', BpmnDeploymentService.name);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`BPMN file not found at ${bpmnFilePath}. Skipping deployment.`, BpmnDeploymentService.name);
      } else {
        throw error;
      }
    }
  }

  // Method to redeploy processes (useful for development)
  async redeployAllProcesses() {
    await this.deployBpmnProcesses();
  }
}
