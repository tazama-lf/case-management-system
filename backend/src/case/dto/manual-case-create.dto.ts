import { AlertType, CaseType, Priority } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualCreateCaseDto {
  @ApiProperty({
    description: 'Alert ID to create case from',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @IsUUID()
  alertId: string;

  @ApiProperty({
    description: 'Priority score for the case (0-1)',
    example: 0.75,
    required: false,
    type: 'number',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  priorityScore?: number;

  @ApiProperty({
    description: 'Type of alert',
    enum: AlertType,
    example: AlertType.FRAUD,
    enumName: 'AlertType',
  })
  @IsEnum(AlertType)
  alertType: AlertType;
}
