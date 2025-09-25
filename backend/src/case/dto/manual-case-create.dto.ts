import { AlertType, CaseType, Priority } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class ManualCreateCaseDto {
  @IsUUID()
  alertId: string;

  @IsOptional()
  @IsNumber()
  priorityScore?: number;

  @IsEnum(CaseType)
  alertType: AlertType;
}
