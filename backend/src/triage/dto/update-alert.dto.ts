// import { Priority, AlertType, PredictionOutcome } from '@prisma/client';

export enum Priority {
  NEW = 'NEW',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
  BREACH = 'BREACH',
}

export enum AlertType {
  FRAUD = 'FRAUD',
  AML = 'AML',
  FRAUD_AND_AML = 'FRAUD_AND_AML',
  NONE = 'NONE',
  SUSPICIOUS = 'SUSPICIOUS',
  INFO = 'INFO',
}

export enum PredictionOutcome {
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  TRUE_POSITIVE = 'TRUE_POSITIVE',
  FALSE_NEGATIVE = 'FALSE_NEGATIVE',
  TRUE_NEGATIVE = 'TRUE_NEGATIVE',
}
import { IsOptional, IsEnum, IsNumber, IsString, MaxLength } from 'class-validator';

export class UpdateAlertDto {
  @IsOptional()
  @IsNumber()
  confidence_per?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsNumber()
  priorityScore?: number;

  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @IsOptional()
  @IsEnum(PredictionOutcome)
  predictionOutcome?: PredictionOutcome;

  @IsString()
  @MaxLength(500)
  note: string;
}
