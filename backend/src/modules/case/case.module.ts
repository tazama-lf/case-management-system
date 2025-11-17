import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskModule } from 'src/modules/task/task.module';
import { CommentModule } from '../comment/comment.module';
import { CaseCreationModule } from '../case-creation/case-creation.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule, CaseCreationModule, TaskModule, AuthModule, CommentModule, NotificationModule],
  providers: [CaseService],
  exports: [CaseService],
  controllers: [CaseController],
})
export class CaseModule {}
