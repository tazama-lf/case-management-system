import { Module, forwardRef } from '@nestjs/common';
import { TaskService } from './task.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskController } from './task.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { WorkQueueModule } from '../work-queue/work-queue.module';
import { FlowableModule } from '../flowable/flowable.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    LoggerModule,
    AuthModule,
    NotificationModule,
    forwardRef(() => FlowableModule),
    forwardRef(() => WorkQueueModule),
  ],
  providers: [TaskService],
  exports: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
