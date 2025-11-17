import { ApiProperty } from '@nestjs/swagger';
import { CaseCreationType, CaseStatus, CaseType, Priority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCaseDto {
  @ApiProperty({
    description: 'Optional parent case ID if this case is a sub-case',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    description: 'Tenant ID associated with the case',
    example: 'tenant-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  tenantId: string;

  @ApiProperty({
    description: 'User ID of the case creator',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  caseCreatorUserId: string;

  @ApiProperty({
    description: 'User ID of the case owner',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  caseOwnerUserId?: string;

  @ApiProperty({
    description: 'Status of the case',
    enum: CaseStatus,
  })
  @IsEnum(CaseStatus)
  status: CaseStatus;

  @ApiProperty({
    description: 'Priority level of the case',
    enum: Priority,
  })
  @IsEnum(Priority)
  priority: Priority;

  @ApiProperty({
    description: 'Type of the case',
    enum: CaseType,
  })
  @IsEnum(CaseType)
  @IsOptional()
  caseType?: CaseType;

  @ApiProperty({
    description: 'Creation type of the case',
    enum: CaseCreationType,
  })
  @IsEnum(CaseCreationType)
  caseCreationType: CaseCreationType;
}
