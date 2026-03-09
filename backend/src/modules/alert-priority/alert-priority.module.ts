import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertPriorityService } from './alert-priority.service';
import { AlertPriorityTask } from './alert-priority.task';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TriageModule } from '../triage/triage.module';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), PrismaModule, TriageModule],
  providers: [AlertPriorityService, AlertPriorityTask],
  exports: [AlertPriorityService],
})
export class AlertPriorityModule {}
