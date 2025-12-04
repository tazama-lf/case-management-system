import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;

  @ApiProperty({ type: 'string' })
  status: string;

  @ApiProperty({ type: 'string' })
  priority: string;

  @ApiProperty({ type: 'string' })
  case_type: string;
}

class AlertDetails {
  @ApiProperty({ type: 'string', format: 'uuid' })
  alert_id: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  case_id: string;
}

export class ManualCaseCreatedResponseDto {
  @ApiProperty({ type: 'boolean', example: true })
  success: boolean;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: AlertDetails })
  alert: AlertDetails;
}
