import { Module } from '@nestjs/common';
import { NatsStartupService } from './nats.startup';
import { TriageModule } from '../triage/triage.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

@Module({
  imports: [TriageModule],
  providers: [NatsStartupService, LoggerService],
  exports: [NatsStartupService],
})
export class NatsModule {}
