import { Module } from '@nestjs/common';
import { TriageModule } from '../modules/triage/triage.module';
import { TaskModule } from '../modules/task/task.module';
import { NatsStartupService } from './nats.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [TriageModule, LoggerModule, TaskModule],
  providers: [NatsStartupService],
  exports: [NatsStartupService],
})
export class NatsModule {}
