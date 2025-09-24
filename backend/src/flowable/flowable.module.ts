import { Module } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { BpmnDeploymentService } from './bpmn-deployment.service';
import { WorkQueueController } from './work-queue.controller';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TaskModule } from '../task/task.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    forwardRef(() => TaskModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [WorkQueueController],
  providers: [FlowableService, BpmnDeploymentService],
  exports: [FlowableService, BpmnDeploymentService],
})
export class FlowableModule {}