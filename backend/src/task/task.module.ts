import { Module, forwardRef } from '@nestjs/common';
import { TaskService } from './task.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { TaskController } from './task.controller';
import { FlowableModule } from 'src/flowable/flowable.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    LoggerModule,
    forwardRef(() => FlowableModule), // Use forwardRef to break circular dependency
  ],
  providers: [TaskService],
  exports: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}