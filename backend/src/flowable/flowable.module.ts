import { Module } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { BpmnDeploymentService } from './bpmn-deployment.service';
import { WorkQueueController } from './work-queue.controller';
import { FlowableEventListener } from './listeners/flowable-event.listener';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TaskModule } from '../task/task.module';
import { AuditLogModule } from 'src/audit/auditLog.module';

@Module({
  imports: [LoggerModule, ConfigModule, TaskModule, AuditLogModule],
  controllers: [WorkQueueController],
  providers: [FlowableService, BpmnDeploymentService, FlowableEventListener],
  exports: [FlowableService, BpmnDeploymentService],
})
export class FlowableModule {}
