import { Priority, AlertType, PredictionOutcome, CaseStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsNumber, IsString, MaxLength } from 'class-validator';

export class ManualTriageDto {
  @IsOptional()
  @IsNumber()
  confidence_per?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

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
