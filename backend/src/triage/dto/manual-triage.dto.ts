// import { Priority, AlertType, PredictionOutcome, CaseStatus } from '@prisma/client';

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

export enum CaseStatus {
  STATUS_00_DRAFT = 'STATUS_00_DRAFT',
  STATUS_01_PENDING_CASE_CREATION_APPROVAL = 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
  STATUS_02_READY_FOR_ASSIGNMENT = 'STATUS_02_READY_FOR_ASSIGNMENT',
  STATUS_03_RETURNED = 'STATUS_03_RETURNED',
  STATUS_10_ASSIGNED = 'STATUS_10_ASSIGNED',
  STATUS_20_IN_PROGRESS = 'STATUS_20_IN_PROGRESS',
  STATUS_21_SUSPENDED = 'STATUS_21_SUSPENDED',
  STATUS_22_PENDING_FINAL_APPROVAL = 'STATUS_22_PENDING_FINAL_APPROVAL',
  STATUS_30_PENDING_REOPENING = 'STATUS_30_PENDING_REOPENING',
  STATUS_31_REOPENED = 'STATUS_31_REOPENED',
  STATUS_71_AUTOCLOSED_CONFIRMED = 'STATUS_71_AUTOCLOSED_CONFIRMED',
  STATUS_72_AUTOCLOSED_REFUTED = 'STATUS_72_AUTOCLOSED_REFUTED',
  STATUS_81_CLOSED_REFUTED = 'STATUS_81_CLOSED_REFUTED',
  STATUS_82_CLOSED_CONFIRMED = 'STATUS_82_CLOSED_CONFIRMED',
  STATUS_83_CLOSED_INCONCLUSIVE = 'STATUS_83_CLOSED_INCONCLUSIVE',
  STATUS_99_ABANDONED = 'STATUS_99_ABANDONED',
}
import { IsOptional, IsEnum, IsNumber, IsString, MaxLength } from 'class-validator';

export class ManualTriageDto {
  @IsOptional()
  @IsNumber()
  confidence_per?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsNumber()
  priorityScore: number;

  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @IsOptional()
  @IsEnum(PredictionOutcome)
  predictionOutcome?: PredictionOutcome;

  @IsString()
  @MaxLength(500)
  note: string;

  @IsEnum(CaseStatus)
  status: CaseStatus;
}
