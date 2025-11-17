import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;

  @ApiProperty({ 
    type: 'string',
    enum: ['STATUS_10_ASSIGNED', 'STATUS_02_READY_FOR_ASSIGNMENT'],
    example: 'STATUS_10_ASSIGNED'
  })
  status: string;

  @ApiProperty({ type: 'string', format: 'uuid', nullable: true })
  case_owner_user_id: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

class CompletedApprovalTask {
  @ApiProperty({ type: 'string', format: 'uuid' })
  task_id: string;

  @ApiProperty({ type: 'string', example: 'STATUS_30_COMPLETED' })
  status: string;
}

class InvestigationTask {
  @ApiProperty({ type: 'string', format: 'uuid' })
  task_id: string;

  @ApiProperty({ type: 'string', example: 'Investigate Case' })
  name: string;

  @ApiProperty({ 
    type: 'string',
    enum: ['STATUS_10_ASSIGNED', 'STATUS_01_UNASSIGNED']
  })
  status: string;

  @ApiProperty({ 
    type: 'string',
    description: 'User ID or candidate group name'
  })
  assigned_to: string;

  @ApiProperty({ type: 'string', example: 'investigations' })
  candidateGroup: string;
}

export class ApproveCaseReopeningResponseDto {
  @ApiProperty({ type: 'boolean', example: true })
  success: boolean;

  @ApiProperty({ type: 'string', example: 'Case reopening approved' })
  message: string;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: CompletedApprovalTask })
  completed_approval_task: CompletedApprovalTask;

  @ApiProperty({ type: InvestigationTask })
  investigation_task: InvestigationTask;
}
