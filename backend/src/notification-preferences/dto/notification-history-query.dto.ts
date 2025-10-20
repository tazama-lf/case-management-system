import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType, DeliveryStatus, NotificationChannel } from '@prisma/client';

export class NotificationHistoryQueryDto {
  @ApiProperty({
    description: 'Filter by notification type',
    enum: NotificationType,
    required: false,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  notification_type?: NotificationType;

  @ApiProperty({
    description: 'Filter by delivery channel',
    enum: NotificationChannel,
    required: false,
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiProperty({
    description: 'Filter by delivery status',
    enum: DeliveryStatus,
    required: false,
  })
  @IsEnum(DeliveryStatus)
  @IsOptional()
  status?: DeliveryStatus;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
