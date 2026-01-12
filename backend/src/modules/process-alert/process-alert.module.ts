import { Module } from '@nestjs/common';
import { ProcessAlertService } from './process-alert.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TriageModule } from '../triage/triage.module';
import { TaskModule } from '../task/task.module';
import { ProcessAlertController } from './process-alert.controller';
import { AuditLogModule } from '../audit/auditLog.module';
import { CaseModule } from '../case/case.module';
import { AlertModule } from '../alert/alert.module';
import { FlowableModule } from '../flowable/flowable.module';
import { TaskSyncModule } from '../task-sync/task-sync.module';

@Module({
  imports: [LoggerModule, AuditLogModule, ConfigModule, TriageModule, AlertModule, TaskModule, CaseModule, FlowableModule, TaskSyncModule],
  providers: [ProcessAlertService],
  exports: [ProcessAlertService],
  controllers: [ProcessAlertController],
})
export class ProcessAlertModule {}
