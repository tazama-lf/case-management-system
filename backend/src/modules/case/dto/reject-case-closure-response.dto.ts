import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;

  @ApiProperty({ type: 'string', example: 'STATUS_20_IN_PROGRESS' })
  status: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

class CompletedApprovalTask {
  @ApiProperty({ type: 'number', example: 124 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'STATUS_30_COMPLETED' })
  status: string;
}

class NewInvestigationTask {
  @ApiProperty({ type: 'number', example: 124 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'Investigate Case' })
  name: string;

  @ApiProperty({ type: 'string', format: 'uuid', description: 'Original investigator user ID' })
  assigned_to: string;

  @ApiProperty({ type: 'string', example: 'STATUS_10_ASSIGNED' })
  status: string;
}

export class RejectCaseClosureResponseDto {
  @ApiProperty({ type: 'string', example: 'Case closure rejected and returned for investigation' })
  message: string;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: CompletedApprovalTask })
  completed_approval_task: CompletedApprovalTask;

  @ApiProperty({ type: NewInvestigationTask })
  new_investigation_task: NewInvestigationTask;
}
