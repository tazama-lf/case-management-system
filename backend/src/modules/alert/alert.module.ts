import { Module } from '@nestjs/common';
import { AlertService } from './alert.service';
import { LoggerModule } from '../../../src/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { RepositoryModule } from '../repository/repository.module';
import { CaseModule } from '../case/case.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { AlertController } from './alert.controller';
import { AlertStatisticsService } from './alert.statistics.service';
import { EventLogModule } from '../event_log/eventLog.module';
import { LoggingOrchestrationModule } from '../logging-orchestration/logging-orchestration.module';

@Module({
  imports: [LoggerModule, LoggingOrchestrationModule, ConfigModule, RepositoryModule, CaseModule, EventLogModule],
  providers: [AlertService, AlertStatisticsService],
  exports: [AlertService, AlertStatisticsService],
  controllers: [AlertController],
})
export class AlertModule {}
