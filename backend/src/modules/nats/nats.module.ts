import { Module } from '@nestjs/common';
import { TriageModule } from '../triage/triage.module';
import { TaskModule } from '../task/task.module';
import { NatsStartupService } from './nats.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ProcessAlertModule } from '../process-alert/process-alert.module';

@Module({
  imports: [ProcessAlertModule, LoggerModule],
  providers: [NatsStartupService],
  exports: [NatsStartupService],
})
export class NatsModule {}
