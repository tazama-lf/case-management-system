import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskLifecycleService } from './services/task-lifecycle.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskController } from './task.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { FlowableModule } from '../flowable/flowable.module';
import { RepositoryModule } from '../repository/repository.module';
import { EventLogModule } from '../event_log/eventLog.module';
import { TaskHistoryModule } from '../task_history/taskHistory.module';
import { CaseHistoryModule } from '../case_history/caseHistory.module';
import { LoggingOrchestrationModule } from '../logging-orchestration/logging-orchestration.module';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    AuthModule,
    NotificationModule,
    FlowableModule,
    RepositoryModule,
    EventLogModule,
    TaskHistoryModule,
    CaseHistoryModule,
    LoggingOrchestrationModule,
  ],
  providers: [TaskService, TaskLifecycleService],
  exports: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
