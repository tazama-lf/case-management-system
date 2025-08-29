import { Module } from '@nestjs/common';
import { TriageModule } from '../triage/triage.module';
import { TaskModule } from '../task/task.module';
import { NatsStartupService } from './nats.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [TriageModule, LoggerModule, TaskModule],
  providers: [NatsStartupService],
  exports: [NatsStartupService],
})
export class NatsModule {}
