import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertPriorityService implements OnModuleInit {
  private readonly logger = new Logger(AlertPriorityService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private urgencyThresholds: number[] = [0.33, 0.66, 1.0];
  private defaultSlaHours: number = 72;
  private updateIntervalMs: number = 3600000; // 1 hour in milliseconds

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const interval = setInterval(() => {
      this.runRecalculation().catch((err) => this.logger.error(err));
    }, this.updateIntervalMs);

    this.schedulerRegistry.addInterval('alert-priority-interval', interval);
    this.intervalRef = interval;
    this.logger.log(
      `Alert priority recalculation scheduled every ${this.updateIntervalMs / 1000} seconds.`,
    );
  }

  async runRecalculation() {
    this.logger.log('Starting alert priority recalculation job...');
    const alerts = await this.prisma.alert.findMany();

    if (!alerts.length) {
      this.logger.log('No alerts to process.');
      return;
    }

    for (const alert of alerts) {
      try {
        const alertData = (alert.alert_data as any) || {};
        const slaHours = Number(alertData.sla_hours) || this.defaultSlaHours;
        const createdAt = new Date(alert.created_at);
        const now = new Date();
        const elapsedHours =
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        const slaProgress = elapsedHours / slaHours;

        const [urgentThreshold, criticalThreshold, breachThreshold] =
          this.urgencyThresholds;
        let urgency = 'New';

        if (slaProgress > breachThreshold) {
          urgency = 'Breach';
        } else if (slaProgress > criticalThreshold) {
          urgency = 'Critical';
        } else if (slaProgress > urgentThreshold) {
          urgency = 'Urgent';
        } else {
          urgency = 'New';
        }

        const priorityScore = 0.5; // Default priority score

        const updatedData = { ...alertData };
        updatedData.priority_score = priorityScore;
        updatedData.urgency = urgency;
        updatedData.sla_hours = slaHours;
        updatedData.sla_progress = Number(slaProgress.toFixed(4));
        updatedData.last_priority_update = now.toISOString();

        await this.prisma.alert.update({
          where: { alert_id: alert.alert_id },
          data: {
            alert_data: updatedData,
          },
        });

        this.logger.debug(
          `Alert ${alert.alert_id}: priority=${priorityScore} urgency=${urgency}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to process alert ${alert.alert_id}: ${err}`,
          (err as Error).stack,
        );
      }
    }

    this.logger.log('Alert priority recalculation job complete.');
  }
}
