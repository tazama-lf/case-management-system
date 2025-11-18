import { Module, forwardRef } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { FlowableWorkQueueListener } from './listeners/work-queue.listener';
import { CaseEventListener } from './listeners/case-event.listener';
import { TaskEventListener } from './listeners/task-event.listener';
import { FlowableUtilitiesService } from './utils/flowable-utilities.service';
import { BpmnSyncService } from './services/bpmn-sync.service';
import { FlowableProcessService } from './services/flowable-process.service';
import { FlowableTaskService } from './services/flowable-task.service';
import { FlowableIdentityService } from './services/flowable-identity.service';
import { LoggerModule } from '../../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TaskModule } from '../task/task.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [LoggerModule, ConfigModule, forwardRef(() => TaskModule), AuditLogModule, PrismaModule],
  providers: [
    FlowableService,
    FlowableProcessService,
    FlowableTaskService,
    FlowableIdentityService,
    FlowableWorkQueueListener,
    CaseEventListener,
    TaskEventListener,
    FlowableUtilitiesService,
    BpmnSyncService,
  ],
  exports: [FlowableService],
})
export class FlowableModule {}
