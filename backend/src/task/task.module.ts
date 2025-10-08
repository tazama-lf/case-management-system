import { Module, forwardRef } from '@nestjs/common';
import { TaskService } from './task.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { TaskController } from './task.controller';
import { FlowableModule } from 'src/flowable/flowable.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    LoggerModule,
    AuthModule,
    forwardRef(() => FlowableModule),
    NotificationModule
  ],
  providers: [TaskService],
  exports: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}