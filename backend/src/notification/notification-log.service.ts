import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel, NotificationType, DeliveryStatus, NotificationLog } from '@prisma/client-cms';
import { NotificationHistoryDto, NotificationHistoryQueryDto } from '../notification-preferences/dto';

@Injectable()
export class NotificationLogService {
  private readonly logger = new Logger(NotificationLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new notification log entry
   */
  async createNotificationLog(params: {
    userId: string;
    tenantId: string;
    taskId?: string;
    caseId?: string;
    notificationType: NotificationType;
    channel: NotificationChannel;
    payload: Record<string, any>;
  }): Promise<NotificationLog> {
    this.logger.log(`Creating notification log for user ${params.userId}, type: ${params.notificationType}, channel: ${params.channel}`);

    const log = await this.prisma.notificationLog.create({
      data: {
        user_id: params.userId,
        tenant_id: params.tenantId,
        task_id: params.taskId,
        case_id: params.caseId,
        notification_type: params.notificationType,
        channel: params.channel,
        delivery_status: DeliveryStatus.PENDING,
        retry_count: 0,
        max_retries: 5,
        payload: params.payload as any,
      },
    });

    return log;
  }

  /**
   * Update notification delivery status
   */
  async updateDeliveryStatus(notificationLogId: string, status: DeliveryStatus, errorMessage?: string): Promise<void> {
    this.logger.log(`Updating notification ${notificationLogId} to status: ${status}`);

    await this.prisma.notificationLog.update({
      where: { notification_log_id: notificationLogId },
      data: {
        delivery_status: status,
        error_message: errorMessage,
        sent_at: status === DeliveryStatus.SENT ? new Date() : undefined,
      },
    });
  }

  /**
   * Increment retry count for a notification
   */
  async incrementRetryCount(notificationLogId: string): Promise<number> {
    const log = await this.prisma.notificationLog.update({
      where: { notification_log_id: notificationLogId },
      data: {
        retry_count: { increment: 1 },
        delivery_status: DeliveryStatus.RETRYING,
      },
    });

    return log.retry_count;
  }

  /**
   * Mark notification as permanently failed
   */
  async markAsPermanentFailure(notificationLogId: string, errorMessage: string): Promise<void> {
    this.logger.error(`Marking notification ${notificationLogId} as permanent failure: ${errorMessage}`);

    await this.prisma.notificationLog.update({
      where: { notification_log_id: notificationLogId },
      data: {
        delivery_status: DeliveryStatus.PERMANENT_FAILURE,
        error_message: errorMessage,
      },
    });
  }

  /**
   * Mark notification as read by user
   */
  async markAsRead(notificationLogId: string): Promise<void> {
    await this.prisma.notificationLog.update({
      where: { notification_log_id: notificationLogId },
      data: {
        read_at: new Date(),
      },
    });
  }

  /**
   * Get notification history for a user
   */
  async getUserNotificationHistory(
    userId: string,
    query: NotificationHistoryQueryDto,
  ): Promise<{ data: NotificationHistoryDto[]; total: number }> {
    const where: any = { user_id: userId };

    if (query.notification_type) {
      where.notification_type = query.notification_type;
    }
    if (query.channel) {
      where.channel = query.channel;
    }
    if (query.status) {
      where.delivery_status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    const data = logs.map((log) => this.mapToHistoryDto(log));

    return { data, total };
  }

  /**
   * Get unread in-app notifications for a user
   */
  async getUnreadNotifications(userId: string, limit = 20): Promise<NotificationHistoryDto[]> {
    const logs = await this.prisma.notificationLog.findMany({
      where: {
        user_id: userId,
        channel: NotificationChannel.IN_APP,
        read_at: null,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => this.mapToHistoryDto(log));
  }

  /**
   * Get failed notifications for retry processing
   */
  async getFailedNotificationsForRetry(): Promise<NotificationLog[]> {
    return this.prisma.notificationLog.findMany({
      where: {
        delivery_status: DeliveryStatus.FAILED,
        retry_count: {
          lt: this.prisma.notificationLog.fields.max_retries,
        },
      },
      orderBy: { created_at: 'asc' },
      take: 100,
    });
  }

  /**
   * Map database entity to DTO
   */
  private mapToHistoryDto(log: NotificationLog): NotificationHistoryDto {
    return {
      notification_log_id: log.notification_log_id,
      user_id: log.user_id,
      task_id: log.task_id,
      case_id: log.case_id,
      notification_type: log.notification_type,
      channel: log.channel,
      delivery_status: log.delivery_status,
      retry_count: log.retry_count,
      payload: log.payload as Record<string, any>,
      error_message: log.error_message,
      sent_at: log.sent_at,
      read_at: log.read_at,
      created_at: log.created_at,
    };
  }
}
