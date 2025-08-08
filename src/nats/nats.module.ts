import { Module } from '@nestjs/common';
import { NatsStartupService } from './nats.startup';
import { TriageModule } from '../triage/triage.module';

@Module({
  imports: [TriageModule],
  providers: [NatsStartupService],
  exports: [NatsStartupService],
})
export class NatsModule {}
