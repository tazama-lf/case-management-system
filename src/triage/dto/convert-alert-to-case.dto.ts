import {IsEnum } from 'class-validator';
import { Priority, CaseType } from '@prisma/client';
import { Type } from 'class-transformer';

export class ConvertAlertToCase {
  @IsEnum(Priority)
  @Type(() => String)
  priority: Priority;
  @IsEnum(CaseType)
  @Type(() => String)
  caseType: CaseType;
}
