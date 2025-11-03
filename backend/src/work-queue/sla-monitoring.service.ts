import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TaskStatus } from '@prisma/client';
import { EventDeduplicator } from '../shared/utils/event-deduplicator';

/**
 * SLA Monitoring Service
 *
 * Monitors task SLA deadlines and emits events when:
 * - Tasks are approaching SLA deadline (warning)
 * - Tasks have breached SLA deadline
 * - Tasks are overdue
 *
 * Runs periodically via cron job to check all active tasks.
 */
@Injectable()
export class SlaMonitoringService {
  private readonly logger = new Logger(SlaMonitoringService.name);
  private readonly warningThresholdHours: number;
  private readonly gracePeriodMinutes: number;
  private isProcessing = false;
  private readonly eventDeduplicator = new EventDeduplicator(5000); // 5 second dedup window

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.warningThresholdHours = this.configService.get<number>('SLA_WARNING_THRESHOLD_HOURS', 2);

    this.gracePeriodMinutes = this.configService.get<number>('SLA_GRACE_PERIOD_MINUTES', 15);

    this.logger.log(`SLA Monitoring Service initialized (Warning: ${this.warningThresholdHours}h, Grace: ${this.gracePeriodMinutes}m)`);
  }

  /**
   * Run SLA check every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkSLAs() {
    if (this.isProcessing) {
      this.logger.warn('Previous SLA check still processing, skipping this iteration');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting SLA check');

      const now = new Date();
      const timeThresholds = this.calculateTimeThresholds(now);

      await this.checkSLAWarnings(now, timeThresholds);

      await this.checkSLABreaches(now, timeThresholds);

      await this.checkOverdueTasks(now, timeThresholds);

      const duration = Date.now() - startTime;
      this.logger.log(`SLA check completed in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Error during SLA check: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Calculate all time thresholds once to avoid repeated date math
   */
  private calculateTimeThresholds(now: Date) {
    return {
      warningTime: new Date(now.getTime() + this.warningThresholdHours * 60 * 60 * 1000),
      graceTime: new Date(now.getTime() - this.gracePeriodMinutes * 60 * 1000),
      overdueThreshold: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      thirtyMinutesAgo: new Date(now.getTime() - 30 * 60 * 1000),
      oneHourAgo: new Date(now.getTime() - 60 * 60 * 1000),
    };
  }

  /**
   * Check for tasks approaching SLA deadline
   */
  private async checkSLAWarnings(now: Date, timeThresholds: ReturnType<typeof this.calculateTimeThresholds>) {
    try {
      const tasksApproachingDeadline = await this.prisma.task.findMany({
        where: {
          sla_deadline: {
            gte: now,
            lte: timeThresholds.warningTime,
          },
          status: {
            not: TaskStatus.STATUS_30_COMPLETED,
          },
          updated_at: {
            lt: timeThresholds.thirtyMinutesAgo,
          },
        },
        include: {
          case: {
            select: {
              case_id: true,
              priority: true,
              status: true,
              tenant_id: true,
            },
          },
          workQueue: {
            select: {
              work_queue_id: true,
              name: true,
            },
          },
        },
      });

      if (tasksApproachingDeadline.length > 0) {
        this.logger.log(`Found ${tasksApproachingDeadline.length} tasks approaching SLA deadline`);

        for (const task of tasksApproachingDeadline) {
          const timeUntilDeadline = task.sla_deadline ? Math.round((task.sla_deadline.getTime() - now.getTime()) / (60 * 1000)) : null;

          const warningPayload = {
            taskId: task.task_id,
            taskName: task.name,
            caseId: task.case_id,
            casePriority: task.case?.priority,
            workQueueId: task.work_queue_id,
            workQueueName: task.workQueue?.name,
            assignedUserId: task.assigned_user_id,
            slaDeadline: task.sla_deadline,
            timeUntilDeadlineMinutes: timeUntilDeadline,
            status: task.status,
            tenantId: task.case?.tenant_id,
            timestamp: now,
          };

          // Emit event with deduplication
          this.eventDeduplicator.emitIfNotDuplicate(this.eventEmitter, 'task.sla-warning', warningPayload);

          this.logger.debug(`Emitted SLA warning for task ${task.task_id} (${timeUntilDeadline} minutes remaining)`);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking SLA warnings: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for tasks that have breached SLA deadline
   */
  private async checkSLABreaches(now: Date, timeThresholds: ReturnType<typeof this.calculateTimeThresholds>) {
    try {
      const tasksBreached = await this.prisma.task.findMany({
        where: {
          sla_deadline: {
            lte: timeThresholds.graceTime,
          },
          status: {
            not: TaskStatus.STATUS_30_COMPLETED,
          },
        },
        include: {
          case: {
            select: {
              case_id: true,
              priority: true,
              status: true,
              tenant_id: true,
            },
          },
          workQueue: {
            select: {
              work_queue_id: true,
              name: true,
            },
          },
        },
      });

      if (tasksBreached.length > 0) {
        this.logger.warn(`Found ${tasksBreached.length} tasks with SLA breaches`);

        for (const task of tasksBreached) {
          const breachDuration = task.sla_deadline ? Math.round((now.getTime() - task.sla_deadline.getTime()) / (60 * 1000)) : null;

          const breachPayload = {
            taskId: task.task_id,
            taskName: task.name,
            caseId: task.case_id,
            casePriority: task.case?.priority,
            workQueueId: task.work_queue_id,
            workQueueName: task.workQueue?.name,
            assignedUserId: task.assigned_user_id,
            slaDeadline: task.sla_deadline,
            breachDurationMinutes: breachDuration,
            status: task.status,
            tenantId: task.case?.tenant_id,
            timestamp: now,
            severity: this.calculateBreachSeverity(breachDuration, task.case?.priority),
          };

          // Emit event with deduplication
          this.eventDeduplicator.emitIfNotDuplicate(this.eventEmitter, 'task.sla-breach', breachPayload);

          this.logger.warn(`Emitted SLA breach for task ${task.task_id} (${breachDuration} minutes overdue)`);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking SLA breaches: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for overdue tasks (tasks that should have been completed by now)
   */
  private async checkOverdueTasks(now: Date, timeThresholds: ReturnType<typeof this.calculateTimeThresholds>) {
    try {
      const overdueTasks = await this.prisma.task.findMany({
        where: {
          created_at: {
            lte: timeThresholds.overdueThreshold,
          },
          status: {
            not: TaskStatus.STATUS_30_COMPLETED,
          },
          updated_at: {
            lt: timeThresholds.oneHourAgo,
          },
        },
        include: {
          case: {
            select: {
              case_id: true,
              priority: true,
              status: true,
              tenant_id: true,
            },
          },
          workQueue: {
            select: {
              work_queue_id: true,
              name: true,
            },
          },
        },
      });

      if (overdueTasks.length > 0) {
        this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

        for (const task of overdueTasks) {
          const daysOverdue = Math.floor((now.getTime() - task.created_at.getTime()) / (24 * 60 * 60 * 1000));

          const overduePayload = {
            taskId: task.task_id,
            taskName: task.name,
            caseId: task.case_id,
            casePriority: task.case?.priority,
            workQueueId: task.work_queue_id,
            workQueueName: task.workQueue?.name,
            assignedUserId: task.assigned_user_id,
            createdAt: task.created_at,
            daysOverdue: daysOverdue,
            status: task.status,
            tenantId: task.case?.tenant_id,
            timestamp: now,
          };

          // Emit event with deduplication
          this.eventDeduplicator.emitIfNotDuplicate(this.eventEmitter, 'task.overdue', overduePayload);

          this.logger.debug(`Emitted overdue event for task ${task.task_id} (${daysOverdue} days old)`);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking overdue tasks: ${error.message}`, error.stack);
    }
  }

  /**
   * Calculate breach severity based on duration and priority
   */
  private calculateBreachSeverity(breachDurationMinutes: number | null, casePriority?: string): string {
    if (!breachDurationMinutes) return 'LOW';

    const breachHours = breachDurationMinutes / 60;

    if (casePriority === 'URGENT' || casePriority === 'HIGH') {
      if (breachHours > 4) return 'CRITICAL';
      if (breachHours > 2) return 'HIGH';
      if (breachHours > 1) return 'MEDIUM';
      return 'LOW';
    }

    if (breachHours > 24) return 'HIGH';
    if (breachHours > 12) return 'MEDIUM';
    if (breachHours > 4) return 'LOW';
    return 'INFO';
  }

  /**
   * Manually trigger SLA check (for testing or on-demand execution)
   */
  async triggerSLACheck(): Promise<{ success: boolean; message: string }> {
    if (this.isProcessing) {
      return {
        success: false,
        message: 'SLA check already in progress',
      };
    }

    try {
      await this.checkSLAs();
      return {
        success: true,
        message: 'SLA check completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `SLA check failed: ${error.message}`,
      };
    }
  }

  /**
   * Get SLA statistics
   */
  async getSLAStatistics(tenantId?: string): Promise<{
    tasksWithSLA: number;
    tasksApproachingDeadline: number;
    tasksBreached: number;
    overdueTasksCount: number;
  }> {
    const now = new Date();
    const timeThresholds = this.calculateTimeThresholds(now);

    const whereClause: any = {
      status: {
        not: TaskStatus.STATUS_30_COMPLETED,
      },
    };

    if (tenantId) {
      whereClause.case = {
        tenant_id: tenantId,
      };
    }

    const [tasksWithSLA, tasksApproachingDeadline, tasksBreached, overdueTasksCount] = await Promise.all([
      this.prisma.task.count({
        where: {
          ...whereClause,
          sla_deadline: { not: null },
        },
      }),

      this.prisma.task.count({
        where: {
          ...whereClause,
          sla_deadline: {
            gte: now,
            lte: timeThresholds.warningTime,
          },
        },
      }),

      this.prisma.task.count({
        where: {
          ...whereClause,
          sla_deadline: {
            lt: timeThresholds.graceTime,
          },
        },
      }),

      this.prisma.task.count({
        where: {
          ...whereClause,
          created_at: {
            lt: timeThresholds.overdueThreshold,
          },
        },
      }),
    ]);

    return {
      tasksWithSLA,
      tasksApproachingDeadline,
      tasksBreached,
      overdueTasksCount,
    };
  }
}
