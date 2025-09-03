import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertPriorityService } from './alert-priority.service';

@Injectable()
export class AlertPriorityTask {
  private readonly logger = new Logger(AlertPriorityTask.name);

  constructor(private readonly priorityService: AlertPriorityService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCron() {
    this.logger.log('Running hourly alert priority recalculation task');
    try {
      await this.priorityService.runRecalculation();
    } catch (error) {
      this.logger.error('Error in hourly alert priority recalculation task:', error);
    }
  }
}
