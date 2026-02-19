import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel, NotificationType, DeliveryStatus } from '@prisma/client-cms';

export class NotificationHistoryDto {
  @ApiProperty({
    description: 'Unique identifier for the notification log',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  notification_log_id: string;

  @ApiProperty({
    description: 'User ID who received the notification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    description: 'Task ID related to the notification',
    example: 1234,
    nullable: true,
  })
  task_id: number | null;

  @ApiProperty({
    description: 'Case ID related to the notification',
    example: 1234,
    nullable: true,
  })
  case_id: number | null;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.TASK_ASSIGNED,
  })
  notification_type: NotificationType;

  @ApiProperty({
    description: 'Delivery channel used',
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Current delivery status',
    enum: DeliveryStatus,
    example: DeliveryStatus.SENT,
  })
  delivery_status: DeliveryStatus;

  @ApiProperty({
    description: 'Number of delivery retry attempts',
    example: 0,
  })
  retry_count: number;

  @ApiProperty({
    description: 'Notification payload data',
    example: {
      taskName: 'Review Transaction',
      caseNumber: 'CASE-2024-001',
      priority: 'HIGH',
    },
  })
  payload: Record<string, any>;

  @ApiProperty({
    description: 'Error message if delivery failed',
    example: 'SMTP connection timeout',
    nullable: true,
  })
  error_message: string | null;

  @ApiProperty({
    description: 'Timestamp when notification was sent',
    example: '2024-01-15T10:30:00Z',
    nullable: true,
  })
  sent_at: Date | null;

  @ApiProperty({
    description: 'Timestamp when notification was read by user',
    example: '2024-01-15T10:35:00Z',
    nullable: true,
  })
  read_at: Date | null;

  @ApiProperty({
    description: 'Notification creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  created_at: Date;
}
