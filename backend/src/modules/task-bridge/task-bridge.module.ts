import { Module } from '@nestjs/common';
import { TaskBridgeService } from './task-bridge.service';
import { LoggerModule } from '../../logger/logger.module';
import { RepositoryModule } from '../repository/repository.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { FlowableModule } from '../flowable/flowable.module';

/**
 * TaskBridgeModule - Breaks circular dependency between FlowableModule and TaskModule
 *
 * This module provides task creation functionality without depending on either
 * FlowableModule or TaskModule, allowing both to use it without circular dependencies.
 */
@Module({
  imports: [LoggerModule, RepositoryModule, FlowableModule, AuditLogModule],
  providers: [TaskBridgeService],
  exports: [TaskBridgeService],
})
export class TaskBridgeModule {}
