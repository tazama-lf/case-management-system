import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'number', example: 123 })
  case_id: number;

  @ApiProperty({ type: 'string', example: 'STATUS_02_READY_FOR_ASSIGNMENT' })
  status: string;

  @ApiProperty({ type: 'string', example: 'URGENT' })
  priority: string;

  @ApiProperty({ type: 'string', example: 'FRAUD' })
  case_type: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

class ApprovedTask {
  @ApiProperty({ type: 'number', example: 1234 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'Approve Case Creation' })
  name: string;

  @ApiProperty({ type: 'string', example: 'STATUS_30_COMPLETED' })
  status: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  assigned_user_id: string;
}

class NewTask {
  @ApiProperty({ type: 'number', example: 1234 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'Investigate case' })
  name: string;

  @ApiProperty({ type: 'string', example: 'STATUS_01_UNASSIGNED' })
  status: string;

  @ApiProperty({ type: 'string', example: 'investigations' })
  candidateGroup: string;
}

export class ApproveCaseCreationResponseDto {
  @ApiProperty({ type: 'boolean', example: true })
  success: boolean;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: ApprovedTask })
  approvedTask: ApprovedTask;

  @ApiProperty({ type: NewTask })
  newTask: NewTask;
}
