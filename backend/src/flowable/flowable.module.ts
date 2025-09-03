import { Module } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { BpmnDeploymentService } from './bpmn-deployment.service';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [LoggerModule, ConfigModule],
  providers: [FlowableService, BpmnDeploymentService],
  exports: [FlowableService, BpmnDeploymentService],
})
export class FlowableModule {}
