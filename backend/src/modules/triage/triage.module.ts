import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { AuditLogService } from '../audit/auditLog.service';
import { LoggerModule } from '../../logger/logger.module';
import { TaskModule } from '../task/task.module';
import { CommentModule } from '../comment/comment.module';
import { FeatureExtractionModule } from 'src/modules/feature-extraction/feature-extraction.module';
import { RepositoryModule } from '../repository/repository.module';
import { AlertModule } from '../alert/alert.module';
import { PrismaModule } from 'prisma/prisma.module';
import { CaseModule } from '../case/case.module';
import { FlowableModule } from '../flowable/flowable.module';
import { EventLogModule } from '../event_log/eventLog.module';
import { TaskHistoryModule } from '../task_history/taskHistory.module';
import { CaseHistoryModule } from '../case_history/caseHistory.module';
import { LoggingOrchestrationModule } from '../logging-orchestration/logging-orchestration.module';

@Module({
  imports: [
    RepositoryModule,
    AlertModule,
    LoggerModule,
    // CaseCreationModule,
    CaseModule,
    TaskModule,
    CommentModule,
    FeatureExtractionModule,
    PrismaModule,
    FlowableModule,
    EventLogModule,
    TaskHistoryModule,
    CaseHistoryModule,
    LoggingOrchestrationModule,
  ],
  controllers: [TriageController],
  providers: [TriageService, AuditLogService],
  exports: [TriageService],
})
export class TriageModule {}
