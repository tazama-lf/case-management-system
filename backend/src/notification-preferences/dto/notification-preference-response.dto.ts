import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client-cms';

export class NotificationPreferenceResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the preference record',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  preference_id: string;

  @ApiProperty({
    description: 'User ID who owns these preferences',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  user_id: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Email notifications enabled',
    example: true,
  })
  email_enabled: boolean;

  @ApiProperty({
    description: 'In-app notifications enabled',
    example: true,
  })
  in_app_enabled: boolean;

  @ApiProperty({
    description: 'SMS notifications enabled',
    example: false,
  })
  sms_enabled: boolean;

  @ApiProperty({
    description: 'Dashboard alert notifications enabled',
    example: true,
  })
  dashboard_enabled: boolean;

  @ApiProperty({
    description: 'Phone number for SMS',
    example: '+1234567890',
    nullable: true,
  })
  phone_number: string | null;

  @ApiProperty({
    description: 'Notification types to suppress',
    example: ['TASK_DUE_SOON'],
    nullable: true,
    type: [String],
  })
  suppression_settings: string[] | null;

  @ApiProperty({
    description: 'Default notification channel',
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  default_channel: NotificationChannel;

  @ApiProperty({
    description: 'Preference creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Preference last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updated_at: Date;
}
