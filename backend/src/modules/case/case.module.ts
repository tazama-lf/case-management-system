import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseQueryService } from './services/case-query.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskModule } from 'src/modules/task/task.module';
import { CommentModule } from '../comment/comment.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { RepositoryModule } from '../repository/repository.module';
import { CaseClosureApprovalService } from './services/case-closure-approval.service';
import { CaseCreationApprovalService } from './services/case-creation-approval.service';
import { CaseReopeningService } from './services/case-reopening.service';
import { FlowableModule } from '../flowable/flowable.module';
import { UserModule } from '../user/user.module';
import { SharedModule } from '../shared/shared.module';
import { EventLogModule } from '../event_log/eventLog.module';
import { CaseHistoryModule } from '../case_history/caseHistory.module';
import { TaskHistoryModule } from '../task_history/taskHistory.module';
import { CaseCreationService } from './services/case-creation.service';
import { LoggingOrchestrationModule } from '../logging-orchestration/logging-orchestration.module';
import { TaskValidationUtil } from '../shared/utils/task-validation.util';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    LoggingOrchestrationModule,
    TaskModule,
    CommentModule,
    NotificationModule,
    RepositoryModule,
    FlowableModule,
    UserModule,
    SharedModule,
    EventLogModule,
    CaseHistoryModule,
    TaskHistoryModule,
  ],
  providers: [
    CaseService,
    CaseQueryService,
    CaseClosureApprovalService,
    CaseCreationApprovalService,
    CaseReopeningService,
    CaseCreationService,
    TaskValidationUtil,
  ],
  exports: [
    CaseService,
    CaseQueryService,
    CaseClosureApprovalService,
    CaseCreationApprovalService,
    CaseReopeningService,
    CaseCreationService,
  ],
  controllers: [CaseController],
})
export class CaseModule {}
