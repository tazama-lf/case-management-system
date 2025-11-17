import { Module, forwardRef } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { FlowableEventListener } from './listeners/flowable-event.listener';
import { FlowableWorkQueueListener } from './listeners/work-queue.listener';
import { LoggerModule } from '../../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TaskModule } from '../task/task.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [LoggerModule, ConfigModule, forwardRef(() => TaskModule), AuditLogModule, PrismaModule],
  providers: [FlowableService, FlowableEventListener, FlowableWorkQueueListener],
  exports: [FlowableService],
})
export class FlowableModule {}
