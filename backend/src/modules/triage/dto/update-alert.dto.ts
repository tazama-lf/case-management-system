import { Priority, AlertType, PredictionOutcome, CaseStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsNumber, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualAlertUpdateDTO {
  @ApiProperty({
    description: 'Confidence percentage (0-100)',
    example: 85.5,
    required: false,
    type: 'number',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  confidence_per?: number;

  @ApiProperty({
    description: 'Alert priority',
    enum: Priority,
    example: Priority.URGENT,
    required: false,
    enumName: 'Priority',
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({
    description: 'Priority score (0-1)',
    example: 0.85,
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
    required: false,
    enumName: 'AlertType',
  })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @ApiProperty({
    description: 'Prediction outcome from ML model',
    enum: PredictionOutcome,
    example: PredictionOutcome.FALSE_POSITIVE,
    required: false,
    enumName: 'PredictionOutcome',
  })
  @IsOptional()
  @IsEnum(PredictionOutcome)
  predictionOutcome?: PredictionOutcome;

  @ApiProperty({
    description: 'Update note explaining the changes',
    example: 'Updated priority based on additional investigation',
    type: 'string',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  note: string;

  @ApiProperty({
    description: 'Case status after triage',
    enum: CaseStatus,
    example: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    required: false,
    enumName: 'CaseStatus',
  })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}
