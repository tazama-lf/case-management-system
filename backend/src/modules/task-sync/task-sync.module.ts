import { Module } from '@nestjs/common';
import { TaskSyncService } from './task-sync.service';
import { TaskModule } from '../task/task.module';
import { LoggerModule } from 'src/logger/logger.module';
import { FlowableModule } from '../flowable/flowable.module';

@Module({
  imports: [TaskModule, FlowableModule, LoggerModule],
  providers: [TaskSyncService],
  exports: [TaskSyncService],
})
export class TaskSyncModule {}
