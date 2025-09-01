import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Priority, CaseType } from '@prisma/client';

export class ConvertAlertToCase {
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @IsOptional()
  @IsUUID()
  caseOwnerUserId?: string;
}
