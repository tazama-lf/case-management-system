import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AlertPriorityService } from './alert-priority.service';
import { CronJob } from 'cron';

@Injectable()
export class AlertPriorityTask implements OnModuleInit {
  private readonly logger = new Logger(AlertPriorityTask.name);

  constructor(
    private readonly priorityService: AlertPriorityService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const expression = this.configService.get<string>('ALERT_PRIORITY_CRON_SCHEDULE') || '0 * * * *';
    const job = new CronJob(expression, async () => {
      await this.handleAlertPriorityUpdate();
    });
    this.schedulerRegistry.addCronJob('alertPriorityUpdate', job);
    job.start();
  }

  async handleAlertPriorityUpdate() {
    this.logger.log('Running alert priority update task...');
    await this.priorityService.runRecalculation();
    this.logger.log('Alert priority update task completed.');
  }
}
