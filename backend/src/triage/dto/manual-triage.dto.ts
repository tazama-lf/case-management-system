import { Priority, AlertType, PredictionOutcome, CaseStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsNumber, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualTriageDto {
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
    required: false,
    enumName: 'AlertType',
  })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @ApiProperty({
    description: 'Prediction outcome from ML model',
    enum: PredictionOutcome,
    example: PredictionOutcome.TRUE_NEGATIVE,
    required: false,
    enumName: 'PredictionOutcome',
  })
  @IsOptional()
  @IsEnum(PredictionOutcome)
  predictionOutcome?: PredictionOutcome;

  @ApiProperty({
    description: 'Triage note explaining the decision',
    example: 'Alert requires immediate investigation due to high confidence score',
    type: 'string',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  note: string;

  @ApiProperty({
    description: 'Case status after triage',
    enum: CaseStatus,
    example: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
    enumName: 'CaseStatus',
  })
  @IsEnum(CaseStatus)
  status: CaseStatus;
}