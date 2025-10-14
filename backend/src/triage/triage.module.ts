import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggerModule } from '../logger/logger.module';
import { TaskModule } from '../task/task.module';
import { CommentModule } from '../comment/comment.module';
import { CaseWorkflowModule } from '../case-workflow/case-workflow.module';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    CaseWorkflowModule,
    TaskModule,
    CommentModule,
  ],
  controllers: [TriageController],
  providers: [TriageService, AuditLogService],
  exports: [TriageService],
})
export class TriageModule {}