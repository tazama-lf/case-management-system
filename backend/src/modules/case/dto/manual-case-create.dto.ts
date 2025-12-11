import { AlertType } from '@prisma/client';
import { IsEnum, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualCreateCaseDto {
  @ApiProperty({
    description: 'Alert ID to create case from',
    example: 123
  })
  alertId: number;

  @ApiProperty({
    description: 'Priority score for the case (0-1)',
    example: 0.75,
    type: 'number',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  priorityScore: number;

  @ApiProperty({
    description: 'Type of alert',
    enum: AlertType,
    example: AlertType.FRAUD,
    enumName: 'AlertType',
  })
  @IsEnum(AlertType)
  alertType: AlertType;
}
