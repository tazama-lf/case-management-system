import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { TaskService } from '../task/task.service';
import { CaseService } from '../case/case.service';
import { UserService } from '../shared/user.service';
import { PrismaModule } from 'prisma/prisma.module';
import { LoggerModule } from '../logger/logger.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { WorkQueueModule } from '../work-queue/work-queue.module';
import { CommentModule } from '../comment/comment.module';
import { CaseWorkflowModule } from '../case-workflow/case-workflow.module';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    AuditLogModule,
    EventEmitterModule.forRoot(),
    ConfigModule,
    AuthModule,
    NotificationModule,
  WorkQueueModule,
  CommentModule,
  CaseWorkflowModule,
  ],
  controllers: [ReportController],
  providers: [ReportService, TaskService, CaseService, UserService],
  exports: [ReportService],
})
export class ReportModule {}
