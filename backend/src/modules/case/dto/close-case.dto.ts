import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, MinLength, MaxLength, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CaseClosureOutcome } from '../../../utils/enums/case-enum';

export class CloseCaseDto {
  @ApiProperty({
    description: 'Recommended outcome for case closure',
    enum: CaseClosureOutcome,
    example: CaseClosureOutcome.CLOSED_CONFIRMED,
  })
  @IsEnum(CaseClosureOutcome)
  @IsNotEmpty()
  recommendedOutcome: CaseClosureOutcome;

  @ApiProperty({
    description: 'Final investigation notes or summary',
    example: 'Investigation completed. Fraud confirmed based on evidence.',
    required: false,
  })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  finalNotes: string;
}

export class ApproveCaseClosureTaskDto {
  @ApiProperty({
    description: 'Task ID for the approval task',
    example: 'task-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  task_id: string;

  @ApiProperty({
    description: 'Case ID being closed',
    example: 'case-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  case_id: string;

  @ApiProperty({
    description: 'Name of the approval task',
    example: 'Approve case closure',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the approval task',
    example: 'Review and approve case closure with recommended outcome',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Recommended outcome for case closure',
    enum: CaseClosureOutcome,
  })
  @IsEnum(CaseClosureOutcome)
  recommendedOutcome: CaseClosureOutcome;

  @ApiProperty({
    description: 'Final notes from investigator',
    required: false,
  })
  @IsString()
  // @IsOptional()
  @MinLength(4)
  @MaxLength(500)
  finalNotes: string;

  @ApiProperty({
    description: 'Recommendations from investigator',
    required: false,
  })
  @IsString()
  @IsOptional()
  recommendations?: string;
}

export class ApproveCaseClosureDto {
  @ApiProperty({
    description: 'Final outcome approved by supervisor',
    enum: CaseClosureOutcome,
    example: CaseClosureOutcome.CLOSED_CONFIRMED,
  })
  @IsEnum(CaseClosureOutcome)
  @IsNotEmpty()
  finalOutcome: CaseClosureOutcome;

  @ApiProperty({
    description: 'Optional supervisor comments on the approval',
    example: 'Reviewed investigation thoroughly. Outcome is appropriate based on evidence.',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(500)
  supervisorComments: string;
}

export class RejectCaseClosureDto {
  @ApiProperty({
    description: 'Reason for rejecting the case closure',
    example: 'Investigation incomplete. Please provide additional analysis on transaction patterns.',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(500)
  rejectionReason: string;
}

export class ReturnCaseForReviewDto {
  @ApiProperty({
    description: 'Comments explaining what needs to be reviewed',
    example: 'Please re-examine the evidence for the third transaction. The analysis may need clarification.',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  reviewComments: string;
}
