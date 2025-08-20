import { Module } from '@nestjs/common';
import { NatsStartupService } from './nats.startup';
import { TriageModule } from '../triage/triage.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [TriageModule, LoggerModule],
  providers: [NatsStartupService],
  exports: [NatsStartupService],
})
export class NatsModule {}
