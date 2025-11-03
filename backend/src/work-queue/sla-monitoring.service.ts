import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TaskStatus } from '@prisma/client';
import { EventDeduplicator } from '../shared/utils/event-deduplicator';
import { CronJob } from 'cron';

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
export class SlaMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(SlaMonitoringService.name);
  private readonly warningThresholdHours: number;
  private readonly gracePeriodMinutes: number;
  private isProcessing = false;
  private processingStartTime: number | null = null;
  private readonly eventDeduplicator = new EventDeduplicator(5000); // 5 second dedup window
  private readonly tenantProcessingLocks = new Map<string, boolean>(); // Per-tenant processing locks

  // Cache frequently used time constants (in milliseconds)
  private readonly TIME_CONSTANTS = {
    MINUTE_MS: 60 * 1000,
    HOUR_MS: 60 * 60 * 1000,
    DAY_MS: 24 * 60 * 60 * 1000,
  };

  private readonly MAX_PROCESSING_TIME_MS = 10 * 60 * 1000; // 10 minutes max processing time

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.warningThresholdHours = this.configService.get<number>('SLA_WARNING_THRESHOLD_HOURS', 2);

    this.gracePeriodMinutes = this.configService.get<number>('SLA_GRACE_PERIOD_MINUTES', 15);

    this.logger.log(`SLA Monitoring Service initialized (Warning: ${this.warningThresholdHours}h, Grace: ${this.gracePeriodMinutes}m)`);
  }

  private readonly BATCH_SIZE = 100; // Process tasks in batches of 100 to avoid memory issues

  async onModuleInit() {
    // Set up configurable cron job for SLA monitoring
    const cronExpression = this.configService.get<string>('SLA_MONITORING_CRON', '*/5 * * * *'); // Default: every 5 minutes
    
    try {
      // Remove default cron job if it exists
      try {
        this.schedulerRegistry.deleteCronJob('sla-monitoring');
      } catch (e) {
        // Job doesn't exist, which is fine
      }

      // Create new configurable cron job
      const job = new CronJob(cronExpression, () => {
        this.checkSLAs();
      });

      this.schedulerRegistry.addCronJob('sla-monitoring', job);
      job.start();

      this.logger.log(`SLA Monitoring cron job scheduled: ${cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to set up SLA monitoring cron job: ${error.message}. Using default schedule.`);
    }
  }

  /**
   * Run SLA check on configurable schedule (default: every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES) // Default fallback, will be overridden dynamically
  async checkSLAs() {
    // Enhanced race condition protection
    if (this.isProcessing) {
      const timeSinceStart = this.processingStartTime ? Date.now() - this.processingStartTime : 0;
      if (timeSinceStart > this.MAX_PROCESSING_TIME_MS) {
        this.logger.error(`SLA processing appears stuck (running for ${timeSinceStart}ms), forcing reset`);
        this.isProcessing = false;
        this.processingStartTime = null;
        this.tenantProcessingLocks.clear();
      } else {
        this.logger.warn(`Previous SLA check still processing (${timeSinceStart}ms), skipping this iteration`);
        return;
      }
    }

    this.isProcessing = true;
    this.processingStartTime = Date.now();

    try {
      this.logger.log('Starting SLA check with race condition protection');

      const now = new Date();
      const timeThresholds = this.calculateTimeThresholds(now);

      // Get all unique tenant IDs to ensure proper tenant isolation
      const activeTenants = await this.getActiveTenants();
      this.logger.log(`Processing SLA checks for ${activeTenants.length} active tenants`);

      // Process each tenant with individual locks to prevent race conditions
      await Promise.allSettled(
        activeTenants.map(async (tenantId) => {
          // Skip if this tenant is already being processed
          if (this.tenantProcessingLocks.get(tenantId)) {
            this.logger.debug(`Tenant ${tenantId} already being processed, skipping`);
            return;
          }

          this.tenantProcessingLocks.set(tenantId, true);
          
          try {
            await this.checkSLAWarningsForTenant(tenantId, now, timeThresholds);
            await this.checkSLABreachesForTenant(tenantId, now, timeThresholds);
            await this.checkOverdueTasksForTenant(tenantId, now, timeThresholds);
          } catch (tenantError) {
            this.logger.error(`Error processing SLA checks for tenant ${tenantId}: ${tenantError.message}`, tenantError.stack);
          } finally {
            this.tenantProcessingLocks.delete(tenantId);
          }
        })
      );

      const duration = Date.now() - this.processingStartTime;
      this.logger.log(`SLA check completed for all tenants in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Error during SLA check: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
      this.processingStartTime = null;
      this.tenantProcessingLocks.clear();
    }
  }

  /**
   * Get all active tenant IDs that have tasks requiring SLA monitoring
   */
  private async getActiveTenants(): Promise<string[]> {
    try {
      const tenants = await this.prisma.case.findMany({
        where: {
          // Cases must have valid tenant_id for isolation
          tasks: {
            some: {
              status: {
                not: TaskStatus.STATUS_30_COMPLETED,
              },
              sla_deadline: {
                not: null,
              },
            },
          },
        },
        select: {
          tenant_id: true,
        },
        distinct: ['tenant_id'],
      });

      const tenantIds = tenants
        .map(t => t.tenant_id)
        .filter((id): id is string => id !== null && id !== undefined && id.trim() !== '');

      this.logger.debug(`Found ${tenantIds.length} active tenants with SLA monitoring requirements`);
      return tenantIds;
    } catch (error) {
      this.logger.error(`Failed to get active tenants: ${error.message}`, error.stack);
      return []; // Return empty array to avoid breaking the monitoring loop
    }
  }

  /**
   * Calculate all time thresholds once to avoid repeated date math
   */
  private calculateTimeThresholds(now: Date) {
    const nowTime = now.getTime();
    return {
      warningTime: new Date(nowTime + this.warningThresholdHours * this.TIME_CONSTANTS.HOUR_MS),
      graceTime: new Date(nowTime - this.gracePeriodMinutes * this.TIME_CONSTANTS.MINUTE_MS),
      overdueThreshold: new Date(nowTime - 72 * this.TIME_CONSTANTS.HOUR_MS),
      thirtyMinutesAgo: new Date(nowTime - 30 * this.TIME_CONSTANTS.MINUTE_MS),
      oneHourAgo: new Date(nowTime - this.TIME_CONSTANTS.HOUR_MS),
    };
  }

  /**
   * Check for tasks approaching SLA deadline for a specific tenant
   */
  private async checkSLAWarningsForTenant(tenantId: string, now: Date, timeThresholds: ReturnType<typeof this.calculateTimeThresholds>) {
    try {
      // First get the total count to log and optimize processing
      const totalCount = await this.prisma.task.count({
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
          case: {
            tenant_id: tenantId,
          },
        },
      });

      if (totalCount === 0) return;

      this.logger.log(`Processing ${totalCount} tasks approaching SLA deadline for tenant ${tenantId}`);

      // Process in batches to avoid memory issues
      let processed = 0;
      while (processed < totalCount) {
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
            case: {
              tenant_id: tenantId,
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
          skip: processed,
          take: this.BATCH_SIZE,
          orderBy: { sla_deadline: 'asc' }, // Process most urgent first
        });

        if (tasksApproachingDeadline.length === 0) break;

        this.logger.debug(`Processing batch of ${tasksApproachingDeadline.length} tasks (${processed + 1}-${processed + tasksApproachingDeadline.length} of ${totalCount})`);

        // Process events asynchronously in batches to avoid blocking
        const nowTime = now.getTime(); // Cache now timestamp for calculations
        const warningPayloads = tasksApproachingDeadline
          .filter(task => {
            // Ensure essential fields are present
            if (!task.task_id || !task.case_id || !task.case?.tenant_id) {
              this.logger.warn(`Skipping task with missing required fields: task_id=${task.task_id}, case_id=${task.case_id}, tenant_id=${task.case?.tenant_id}`);
              return false;
            }
            return true;
          })
          .map(task => {
            const timeUntilDeadline = task.sla_deadline ? Math.round((task.sla_deadline.getTime() - nowTime) / this.TIME_CONSTANTS.MINUTE_MS) : null;

            return {
              taskId: task.task_id,
              taskName: task.name || 'Unnamed Task',
              caseId: task.case_id,
              casePriority: task.case?.priority || 'NORMAL',
              workQueueId: task.work_queue_id,
              workQueueName: task.workQueue?.name || 'Unknown Queue',
              assignedUserId: task.assigned_user_id,
              slaDeadline: task.sla_deadline,
              timeUntilDeadlineMinutes: timeUntilDeadline,
              status: task.status,
              tenantId: task.case?.tenant_id!,
              timestamp: now,
            };
          });

        // Emit events asynchronously to avoid blocking the monitoring loop
        setImmediate(() => {
          warningPayloads.forEach(payload => {
            this.eventDeduplicator.emitIfNotDuplicate(this.eventEmitter, 'task.sla-warning', payload);
            this.logger.debug(`Emitted SLA warning for task ${payload.taskId} (${payload.timeUntilDeadlineMinutes} minutes remaining)`);
          });
        });

        processed += tasksApproachingDeadline.length;
      }
    } catch (error) {
      this.logger.error(`Error checking SLA warnings: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for tasks that have breached SLA deadline for a specific tenant
   */
  private async checkSLABreachesForTenant(tenantId: string, now: Date, timeThresholds: ReturnType<typeof this.calculateTimeThresholds>) {
    try {
      // First get the total count to log and optimize processing
      const totalCount = await this.prisma.task.count({
        where: {
          sla_deadline: {
            lte: timeThresholds.graceTime,
          },
          status: {
            not: TaskStatus.STATUS_30_COMPLETED,
          },
          case: {
            tenant_id: tenantId,
          },
        },
      });

      if (totalCount === 0) return;

      this.logger.warn(`Processing ${totalCount} tasks with SLA breaches for tenant ${tenantId}`);

      // Process in batches to avoid memory issues
      let processed = 0;
      while (processed < totalCount) {
        const tasksBreached = await this.prisma.task.findMany({
          where: {
            sla_deadline: {
              lte: timeThresholds.graceTime,
            },
            status: {
              not: TaskStatus.STATUS_30_COMPLETED,
            },
            case: {
              tenant_id: tenantId,
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
          skip: processed,
          take: this.BATCH_SIZE,
          orderBy: { sla_deadline: 'asc' }, // Process most overdue first
        });

        if (tasksBreached.length === 0) break;

        this.logger.debug(`Processing breach batch of ${tasksBreached.length} tasks (${processed + 1}-${processed + tasksBreached.length} of ${totalCount})`);

        // Process events asynchronously in batches to avoid blocking
        const nowTime = now.getTime(); // Cache now timestamp for calculations
        const breachPayloads = tasksBreached
          .filter(task => {
            // Ensure essential fields are present
            if (!task.task_id || !task.case_id || !task.case?.tenant_id || !task.sla_deadline) {
              this.logger.warn(`Skipping breach task with missing required fields: task_id=${task.task_id}, case_id=${task.case_id}, tenant_id=${task.case?.tenant_id}, sla_deadline=${task.sla_deadline}`);
              return false;
            }
            return true;
          })
          .map(task => {
            const breachDuration = Math.round((nowTime - task.sla_deadline!.getTime()) / this.TIME_CONSTANTS.MINUTE_MS);

            return {
              taskId: task.task_id,
              taskName: task.name || 'Unnamed Task',
              caseId: task.case_id,
              casePriority: task.case?.priority || 'NORMAL',
              workQueueId: task.work_queue_id,
              workQueueName: task.workQueue?.name || 'Unknown Queue',
              assignedUserId: task.assigned_user_id,
              slaDeadline: task.sla_deadline!,
              breachDurationMinutes: breachDuration,
              status: task.status,
              tenantId: task.case?.tenant_id!,
              timestamp: now,
              severity: this.calculateBreachSeverity(breachDuration, task.case?.priority),
            };
          });

        // Emit events asynchronously to avoid blocking the monitoring loop
        setImmediate(() => {
          breachPayloads.forEach(payload => {
            this.eventDeduplicator.emitIfNotDuplicate(this.eventEmitter, 'task.sla-breach', payload);
            this.logger.warn(`Emitted SLA breach for task ${payload.taskId} (${payload.breachDurationMinutes} minutes overdue)`);
          });
        });

        processed += tasksBreached.length;
      }
    } catch (error) {
      this.logger.error(`Error checking SLA breaches: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for overdue tasks (tasks that should have been completed by now) for a specific tenant
   */
  private async checkOverdueTasksForTenant(tenantId: string, now: Date, timeThresholds: ReturnType<typeof this.calculateTimeThresholds>) {
    try {
      // First get the total count to log and optimize processing
      const totalCount = await this.prisma.task.count({
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
          case: {
            tenant_id: tenantId,
          },
        },
      });

      if (totalCount === 0) return;

      this.logger.log(`Processing ${totalCount} overdue tasks for tenant ${tenantId}`);

      // Process in batches to avoid memory issues
      let processed = 0;
      while (processed < totalCount) {
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
            case: {
              tenant_id: tenantId,
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
          skip: processed,
          take: this.BATCH_SIZE,
          orderBy: { created_at: 'asc' }, // Process oldest first
        });

        if (overdueTasks.length === 0) break;

        this.logger.debug(`Processing overdue batch of ${overdueTasks.length} tasks (${processed + 1}-${processed + overdueTasks.length} of ${totalCount})`);

        // Process events asynchronously in batches to avoid blocking
        const nowTime = now.getTime(); // Cache now timestamp for calculations
        const overduePayloads = overdueTasks
          .filter(task => {
            // Ensure essential fields are present
            if (!task.task_id || !task.case_id || !task.case?.tenant_id || !task.created_at) {
              this.logger.warn(`Skipping overdue task with missing required fields: task_id=${task.task_id}, case_id=${task.case_id}, tenant_id=${task.case?.tenant_id}, created_at=${task.created_at}`);
              return false;
            }
            return true;
          })
          .map(task => {
            const daysOverdue = Math.floor((nowTime - task.created_at.getTime()) / this.TIME_CONSTANTS.DAY_MS);

            return {
              taskId: task.task_id,
              taskName: task.name || 'Unnamed Task',
              caseId: task.case_id,
              casePriority: task.case?.priority || 'NORMAL',
              workQueueId: task.work_queue_id,
              workQueueName: task.workQueue?.name || 'Unknown Queue',
              assignedUserId: task.assigned_user_id,
              createdAt: task.created_at,
              daysOverdue: daysOverdue,
              status: task.status,
              tenantId: task.case?.tenant_id!,
              timestamp: now,
            };
          });

        // Emit events asynchronously to avoid blocking the monitoring loop
        setImmediate(() => {
          overduePayloads.forEach(payload => {
            this.eventDeduplicator.emitIfNotDuplicate(this.eventEmitter, 'task.overdue', payload);
            this.logger.debug(`Emitted overdue event for task ${payload.taskId} (${payload.daysOverdue} days old)`);
          });
        });

        processed += overdueTasks.length;
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

    // Convert to hours using cached constant
    const breachHours = breachDurationMinutes / 60;

    // Priority-based severity thresholds
    const isHighPriority = casePriority === 'URGENT' || casePriority === 'HIGH';
    
    if (isHighPriority) {
      if (breachHours > 4) return 'CRITICAL';
      if (breachHours > 2) return 'HIGH';
      if (breachHours > 1) return 'MEDIUM';
      return 'LOW';
    }

    // Standard priority severity thresholds
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
