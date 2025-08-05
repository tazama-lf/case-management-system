import { IsEnum } from 'class-validator';
import { CaseType } from '@prisma/client';
import { Type } from 'class-transformer';

export class InvestigateAlertDto {
  @IsEnum(CaseType)
  @Type(() => String)
  caseType: CaseType;
}
