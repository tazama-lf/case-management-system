import { Module } from '@nestjs/common';
import { CaseSyncService } from './case-sync.service';
import { LoggerModule } from 'src/logger/logger.module';
import { LoggingOrchestrationModule } from '../logging-orchestration/logging-orchestration.module';
import { RepositoryModule } from '../repository/repository.module';
import { FlowableModule } from '../flowable/flowable.module';
import { TaskModule } from '../task/task.module';
import { TaskSyncModule } from '../task-sync/task-sync.module';

@Module({
  imports: [LoggerModule, RepositoryModule, TaskSyncModule, TaskModule, FlowableModule, LoggingOrchestrationModule],
  providers: [CaseSyncService],
  exports: [CaseSyncService],
})
export class CaseSyncModule {}
