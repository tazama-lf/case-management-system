import { Module } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { FlowableWorkQueueListener } from './listeners/work-queue.listener';
import { CaseEventListener } from './listeners/case-event.listener';
import { TaskEventListener } from './listeners/task-event.listener';
import { FlowableUtilitiesService } from './services/flowable-utilities.service';
import { FlowableProcessService } from './services/flowable-process.service';
import { FlowableTaskService } from './services/flowable-task.service';
import { FlowableIdentityService } from './services/flowable-identity.service';
import { FlowableClientFactory } from './services/flowable-client.factory';
import { LoggerModule } from '../../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [LoggerModule, ConfigModule, RepositoryModule, AuditLogModule, PrismaModule],
  providers: [
    FlowableClientFactory,
    FlowableService,
    FlowableProcessService,
    FlowableTaskService,
    FlowableIdentityService,
    FlowableUtilitiesService,
    FlowableWorkQueueListener,
    CaseEventListener,
    TaskEventListener,
  ],
  exports: [FlowableService, FlowableProcessService, FlowableTaskService],
})
export class FlowableModule {}
