import { CaseType } from '@prisma/client-cms';
import { IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualCreateCaseDto {
  @ApiProperty({
    description: 'Alert ID to create case from',
    example: 123,
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
    enum: CaseType,
    example: CaseType.FRAUD,
    enumName: 'AlertType',
  })
  @IsEnum(CaseType)
  alertType: CaseType;
}
