import { Controller, Post, Get } from '@nestjs/common';
import { BpmnDeploymentService } from './bpmn-deployment.service';

@Controller('api/v1/flowable/deployment')
export class BpmnDeploymentController {
  constructor(private readonly bpmnDeploymentService: BpmnDeploymentService) {}

  @Post('deploy')
  async deployBpmn(): Promise<{ message: string }> {
    return await this.bpmnDeploymentService.redeployUnifiedProcess();
  }

  @Get('status')
  async getStatus() {
    return await this.bpmnDeploymentService.getDeploymentStatus();
  }
}
