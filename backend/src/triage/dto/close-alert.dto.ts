import { CaseStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CloseAlertDto {
  @IsEnum(CaseStatus)
  status: CaseStatus;
}
