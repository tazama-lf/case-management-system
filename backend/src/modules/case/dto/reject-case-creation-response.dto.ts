import { ApiProperty } from '@nestjs/swagger';

export class CaseDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;

  @ApiProperty({ type: 'string', example: 'STATUS_00_DRAFT' })
  status: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class CompletedTask {
  @ApiProperty({ type: 'number', example: 124 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'Approve Case Creation' })
  name: string;

  @ApiProperty({ type: 'string', example: 'STATUS_30_COMPLETED' })
  status: string;
}

export class NewTask {
  @ApiProperty({ type: 'string', example: 124 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'Complete New Case' })
  name: string;

  @ApiProperty({ type: 'string', example: 'STATUS_10_ASSIGNED' })
  status: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  assigned_user_id: string;

  @ApiProperty({ type: 'string', example: 'Revise and complete the case as per supervisor feedback' })
  description: string;
}

export class RejectCaseCreationResponseDto {
  @ApiProperty({ type: 'boolean', example: true })
  success: boolean;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: CompletedTask })
  completedTask: CompletedTask;

  @ApiProperty({ type: NewTask })
  newTask: NewTask;
}
