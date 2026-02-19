import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;

  @ApiProperty({
    type: 'string',
    enum: [
      'STATUS_81_CLOSED_REFUTED',
      'STATUS_82_CLOSED_CONFIRMED',
      'STATUS_83_CLOSED_INCONCLUSIVE',
      'STATUS_71_AUTOCLOSED_CONFIRMED',
      'STATUS_72_AUTOCLOSED_REFUTED',
    ],
    example: 'STATUS_82_CLOSED_CONFIRMED'
  })
  status: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

class CompletedTask {
  @ApiProperty({ type: 'number', example: 1234 })
  task_id: number;

  @ApiProperty({ type: 'string', example: 'STATUS_30_COMPLETED' })
  status: string;
}

export class RejectCaseReopeningResponseDto {
  @ApiProperty({ type: 'boolean', example: true })
  success: boolean;

  @ApiProperty({ type: 'string', example: 'Case reopening rejected' })
  message: string;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: CompletedTask })
  completed_task: CompletedTask;

  @ApiProperty({ type: 'string' })
  rejection_reason: string;
}
