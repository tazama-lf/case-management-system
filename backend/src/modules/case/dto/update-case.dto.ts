import { ApiProperty } from '@nestjs/swagger';
import { CaseStatus, CaseType, Priority } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UpdateCaseDto {
  @ApiProperty({
    description: 'User ID of the new case owner',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  caseOwnerUserId?: string;

  @ApiProperty({
    description: 'Updated status of the case',
    enum: CaseStatus,
  })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiProperty({
    description: 'Priority level of the case',
    enum: Priority,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({
    description: 'Type of the case',
    enum: CaseType,
  })
  @IsEnum(CaseType)
  @IsOptional()
  caseType?: CaseType;
}
