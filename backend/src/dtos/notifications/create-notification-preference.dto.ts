import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsPhoneNumber, IsArray } from 'class-validator';
import { NotificationChannel, NotificationType } from '@prisma/client';

export class CreateNotificationPreferenceDto {
  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  email_enabled?: boolean = true;

  @ApiProperty({
    description: 'Enable in-app notifications',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  in_app_enabled?: boolean = true;

  @ApiProperty({
    description: 'Enable SMS notifications',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  sms_enabled?: boolean = false;

  @ApiProperty({
    description: 'Enable dashboard alert notifications',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  dashboard_enabled?: boolean = true;

  @ApiProperty({
    description: 'Phone number for SMS notifications (required if SMS enabled)',
    example: '+1234567890',
    required: false,
  })
  @IsPhoneNumber()
  @IsOptional()
  phone_number?: string;

  @ApiProperty({
    description: 'Array of notification types to suppress',
    example: ['TASK_DUE_SOON', 'WORK_QUEUE_ADDED'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsOptional()
  suppression_settings?: string[];

  @ApiProperty({
    description: 'Default notification channel',
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
    default: NotificationChannel.EMAIL,
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  default_channel?: NotificationChannel = NotificationChannel.EMAIL;
}
