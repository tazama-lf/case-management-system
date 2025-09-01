import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggerModule } from '../logger/logger.module';
import { CaseModule } from '../case/case.module';
import { TaskModule } from '../task/task.module';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [PrismaModule, LoggerModule, CaseModule, TaskModule, CommentModule],
  controllers: [TriageController],
  providers: [TriageService, AuditLogService],
  exports: [TriageService],
})
export class TriageModule {}
