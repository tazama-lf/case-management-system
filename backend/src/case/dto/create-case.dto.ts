import { CaseCreationType, CaseStatus, CaseType, Priority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCaseDto {
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsString()
  tenantId: string;

  @IsUUID()
  caseCreatorUserId: string;

  @IsUUID()
  @IsOptional()
  caseOwnerUserId?: string;

  @IsEnum(CaseStatus)
  status: CaseStatus;

  @IsEnum(Priority)
  priority: Priority;

  @IsEnum(CaseType)
  @IsOptional()
  caseType?: CaseType;

  @IsEnum(CaseCreationType)
  caseCreationType: CaseCreationType;
}
