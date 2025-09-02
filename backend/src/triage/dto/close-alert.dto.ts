import { CaseStatus } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CloseAlertDto {
  @IsString()
  reason: string;

  @IsEnum(CaseStatus)
  status: CaseStatus;
}
