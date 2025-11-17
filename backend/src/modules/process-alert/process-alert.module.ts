import { Module } from '@nestjs/common';
import { ProcessAlertService } from './process-alert.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { TriageModule } from '../triage/triage.module';
import { TaskModule } from '../task/task.module';
import { CaseCreationModule } from '../case-creation/case-creation.module';
import { ProcessAlertController } from './process-alert.controller';
import { AuditLogModule } from '../audit/auditLog.module';

@Module({
  imports: [LoggerModule, AuditLogModule, ConfigModule, TriageModule, TaskModule, CaseCreationModule],
  providers: [ProcessAlertService],
  exports: [ProcessAlertService],
  controllers: [ProcessAlertController],
})
export class ProcessAlertModule {}
