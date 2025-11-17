import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationLogService } from './notification-log.service';
import { NotificationService } from './notification.service';
import { NotificationChannel, DeliveryStatus } from '@prisma/client';
import { UserService } from '../shared/user.service';

interface RetryConfig {
  maxRetries: number;
  backoffIntervals: number[]; // In milliseconds
}

@Injectable()
export class NotificationRetryService {
  private readonly logger = new Logger(NotificationRetryService.name);
  private readonly retryConfig: RetryConfig = {
    maxRetries: 5,
    backoffIntervals: [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 4 * 60 * 60 * 1000],
  };

  constructor(
    private readonly notificationLogService: NotificationLogService,
    private readonly notificationService: NotificationService,
    @Optional() private readonly userService?: UserService,
  ) {}

  /**
   * Scheduled job to process failed notifications
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processRetryQueue(): Promise<void> {
    this.logger.log('Processing notification retry queue...');

    try {
      const failedNotifications = await this.notificationLogService.getFailedNotificationsForRetry();

      if (failedNotifications.length === 0) {
        this.logger.log('No failed notifications to retry');
        return;
      }

      this.logger.log(`Found ${failedNotifications.length} failed notifications to retry`);

      for (const notification of failedNotifications) {
        await this.retryNotification(notification);
      }

      this.logger.log('Retry queue processing completed');
    } catch (error) {
      this.logger.error('Error processing retry queue:', error);
    }
  }

  /**
   * Retry a single notification
   */
  private async retryNotification(notification: any): Promise<void> {
    const { notification_log_id, retry_count, max_retries, channel, payload, user_id } = notification;

    if (retry_count >= max_retries) {
      await this.notificationLogService.markAsPermanentFailure(notification_log_id, `Exceeded maximum retry attempts (${max_retries})`);
      this.logger.warn(`Notification ${notification_log_id} marked as permanent failure after ${retry_count} retries`);
      return;
    }

    const backoffDelay = this.getBackoffDelay(retry_count);
    const notificationAge = Date.now() - new Date(notification.created_at).getTime();

    if (notificationAge < backoffDelay) {
      this.logger.debug(`Notification ${notification_log_id} not ready for retry yet (waiting for backoff period)`);
      return;
    }

    const newRetryCount = await this.notificationLogService.incrementRetryCount(notification_log_id);
    this.logger.log(`Retrying notification ${notification_log_id} (attempt ${newRetryCount}/${max_retries})`);

    try {
      await this.resendNotification(channel, user_id, payload);

      await this.notificationLogService.updateDeliveryStatus(notification_log_id, DeliveryStatus.SENT);
      this.logger.log(`Notification ${notification_log_id} successfully resent on retry ${newRetryCount}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Retry attempt ${newRetryCount} failed for notification ${notification_log_id}:`, errorMessage);

      if (newRetryCount >= max_retries) {
        await this.notificationLogService.markAsPermanentFailure(
          notification_log_id,
          `All retry attempts exhausted. Last error: ${errorMessage}`,
        );
      } else {
        await this.notificationLogService.updateDeliveryStatus(notification_log_id, DeliveryStatus.FAILED, errorMessage);
      }
    }
  }

  /**
   * Resend notification based on channel
   */
  private async resendNotification(channel: NotificationChannel, userId: string, payload: any): Promise<void> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        await this.resendEmailNotification(userId, payload);
        break;

      case NotificationChannel.IN_APP:
        this.logger.log(`In-app notification for user ${userId} stored and available for retrieval`);
        break;

      case NotificationChannel.SMS:
        await this.resendSmsNotification(userId, payload);
        break;

      case NotificationChannel.DASHBOARD:
        this.logger.log(`Dashboard notification for user ${userId} stored and available`);
        break;

      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  /**
   * Resend email notification
   */
  private async resendEmailNotification(userId: string, payload: any): Promise<void> {
    const userEmail = this.userService ? await this.userService.getUserEmail(userId) : null;
    const email = userEmail || `user-${userId}@example.com`;
    const template = {
      subject: payload.subject || 'Notification',
      html: payload.html || payload.message || 'You have a new notification',
    };

    await this.notificationService['safeSendEmail'](email, template);
  }

  /**
   * Resend SMS notification
   */
  private async resendSmsNotification(userId: string, payload: any): Promise<void> {
    this.logger.log(`SMS notification retry for user ${userId} - SMS service not yet implemented`);
    throw new Error('SMS service not yet implemented');
  }

  /**
   * Get backoff delay in milliseconds based on retry count
   */
  private getBackoffDelay(retryCount: number): number {
    if (retryCount < this.retryConfig.backoffIntervals.length) {
      return this.retryConfig.backoffIntervals[retryCount];
    }

    return this.retryConfig.backoffIntervals[this.retryConfig.backoffIntervals.length - 1];
  }

  /**
   * Manually trigger a retry for a specific notification
   * Useful for administrative purposes
   */
  async manualRetry(notificationLogId: string): Promise<void> {
    this.logger.log(`Manual retry triggered for notification ${notificationLogId}`);

    const notification = await this.notificationLogService['prisma'].notificationLog.findUnique({
      where: { notification_log_id: notificationLogId },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationLogId} not found`);
    }

    if (notification.delivery_status === DeliveryStatus.SENT) {
      throw new Error(`Notification ${notificationLogId} was already sent successfully`);
    }

    await this.retryNotification(notification);
  }

  /**
   * Get retry statistics
   */
  async getRetryStatistics(): Promise<{
    totalFailed: number;
    pendingRetries: number;
    permanentFailures: number;
    averageRetryCount: number;
  }> {
    const stats = await this.notificationLogService['prisma'].notificationLog.groupBy({
      by: ['delivery_status'],
      _count: {
        notification_log_id: true,
      },
      _avg: {
        retry_count: true,
      },
    });

    const failed = stats.find((s) => s.delivery_status === DeliveryStatus.FAILED)?._count.notification_log_id || 0;
    const retrying = stats.find((s) => s.delivery_status === DeliveryStatus.RETRYING)?._count.notification_log_id || 0;
    const permanentFailures = stats.find((s) => s.delivery_status === DeliveryStatus.PERMANENT_FAILURE)?._count.notification_log_id || 0;

    const avgRetryCount = stats.reduce((sum, s) => sum + (s._avg.retry_count || 0), 0) / (stats.length || 1);

    return {
      totalFailed: failed,
      pendingRetries: retrying,
      permanentFailures,
      averageRetryCount: Math.round(avgRetryCount * 100) / 100,
    };
  }
}
