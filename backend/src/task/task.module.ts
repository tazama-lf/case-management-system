import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { TaskController } from './task.controller';
import { FlowableModule } from 'src/flowable/flowable.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule, FlowableModule],
  providers: [TaskService],
  exports: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
