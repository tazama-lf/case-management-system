import { Module } from '@nestjs/common';
import { ReportsController} from './report.controller';
import { ReportsService } from './report.service';
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
import { TaskModule } from 'src/task/task.module';
import { CaseModule } from 'src/case/case.module';

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
  CaseModule,
  TaskModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, TaskService, CaseService, UserService],
  exports: [ReportsService],
})
export class ReportModule {}

