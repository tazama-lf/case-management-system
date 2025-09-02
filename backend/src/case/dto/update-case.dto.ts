import { CaseStatus, CaseType, Priority } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UpdateCaseDto {
  @IsOptional()
  @IsUUID()
  caseOwnerUserId: string;

  @IsEnum(CaseStatus)
  status: CaseStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority: Priority;

  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;
}
