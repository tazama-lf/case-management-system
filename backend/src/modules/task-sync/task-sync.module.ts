import { Module } from '@nestjs/common';
import { TaskSyncService } from './task-sync.service';
import { TaskModule } from '../task/task.module';
import { RepositoryModule } from '../repository/repository.module';
import { LoggerModule } from 'src/logger/logger.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { EventLogModule } from '../event_log/eventLog.module';
import { TaskHistoryModule } from '../task_history/taskHistory.module';
import { FlowableModule } from '../flowable/flowable.module';

@Module({
  imports: [TaskModule, FlowableModule, LoggerModule, AuditLogModule, EventLogModule],
  providers: [TaskSyncService],
  exports: [TaskSyncService],
})
export class TaskSyncModule {}
