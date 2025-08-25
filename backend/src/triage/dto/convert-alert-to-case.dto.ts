import { IsEnum, IsUUID, IsOptional } from 'class-validator';
import { Priority, CaseType } from '@prisma/client';
import { Type } from 'class-transformer';

export class ConvertAlertToCase {
  @IsOptional()
  @IsEnum(Priority)
  @Type(() => String)
  priority: Priority;
  @IsEnum(CaseType)
  @Type(() => String)
  caseType: CaseType;
  @IsOptional()
  @IsUUID('all')
  @Type(() => String)
  caseOwnerUserId: string;
}
