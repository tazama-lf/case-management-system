import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;

  @ApiProperty({ type: 'string', example: 'STATUS_20_IN_PROGRESS' })
  status: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updated_at: string;
}

export class ReturnCaseForReviewResponseDto {
  @ApiProperty({ type: 'string', example: 'Case returned for review' })
  message: string;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;
}
