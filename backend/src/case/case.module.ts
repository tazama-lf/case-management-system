import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { CaseUpdateListener } from './listeners/case-update.listener';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { TaskModule } from 'src/task/task.module';
import { CommentModule } from '../comment/comment.module';
import { CaseWorkflowModule } from '../case-workflow/case-workflow.module';
import {NotificationModule} from "../notification/notification.module";

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    LoggerModule,
    CaseWorkflowModule,
    TaskModule,
    CommentModule,
    NotificationModule,
  ],
  providers: [CaseService, CaseUpdateListener],
  exports: [CaseService],
  controllers: [CaseController],
})
export class CaseModule {}