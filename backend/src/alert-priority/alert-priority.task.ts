import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AlertPriorityService } from './alert-priority.service';

@Injectable()
export class AlertPriorityTask {
  constructor(
    private readonly priorityService: AlertPriorityService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(process.env.ALERT_PRIORITY_CRON_SCHEDULE || '0 * * * *')
  async handleAlertPriorityUpdate() {
    console.log('Running alert priority update task...');
    await this.priorityService.runRecalculation();
    console.log('Alert priority update task completed.');
  }
}
