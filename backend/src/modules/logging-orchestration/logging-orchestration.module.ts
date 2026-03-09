import { Module } from '@nestjs/common';
import { LoggingOrchestrationService } from './logging-orchestration.service';
import { LoggerModule } from 'src/logger/logger.module';
import { EventLogModule } from '../event_log/eventLog.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { TaskHistoryModule } from '../task_history/taskHistory.module';
import { CaseHistoryModule } from '../case_history/caseHistory.module';

@Module({
  imports: [LoggerModule, EventLogModule, AuditLogModule, CaseHistoryModule, TaskHistoryModule],
  providers: [LoggingOrchestrationService],
  exports: [LoggingOrchestrationService],
})
export class LoggingOrchestrationModule {}
