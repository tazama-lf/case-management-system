import { ApiProperty } from '@nestjs/swagger';
import { CaseStatus, CaseType, Priority, PredictionOutcome } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID, IsNumber,IsString, MaxLength, MinLength } from 'class-validator';

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

  @IsEnum(PredictionOutcome)
  @ApiProperty({
    description: 'Prediction outcome of the alert',
    example: PredictionOutcome.TRUE_POSITIVE,
  })
  @IsOptional()
  predictionOutcome?: PredictionOutcome;

  @IsNumber()
  @ApiProperty({
    description: 'Confidence percentage of the alert',
    example: 85,
  })
  confidence?: number;

  @ApiProperty({
    description: 'Update note explaining the changes',
    example: 'Updated priority based on additional investigation',
    type: 'string',
    maxLength: 500,
    })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    description: 'Priority score for the case (0-1)',
    example: 0.75,
    type: 'number',
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  priorityScore?: number;

     
}
