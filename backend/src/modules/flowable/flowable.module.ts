import { Module } from '@nestjs/common';
import { FlowableService } from './flowable.service';
import { CaseEventListener } from './listeners/case-event.listener';
import { TaskEventListener } from './listeners/task-event.listener';
import { FlowableUtilitiesService } from './services/flowable-utilities.service';
import { FlowableProcessService } from './services/flowable-process.service';
import { FlowableTaskService } from './services/flowable-task.service';
import { FlowableClientFactory } from './services/flowable-client.factory';
import { LoggerModule } from '../../logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [LoggerModule, ConfigModule, RepositoryModule, PrismaModule],
  providers: [
    FlowableClientFactory,
    FlowableService,
    FlowableProcessService,
    FlowableTaskService,
    FlowableUtilitiesService,
    CaseEventListener,
    TaskEventListener,
  ],
  exports: [FlowableService],
})
export class FlowableModule {}
