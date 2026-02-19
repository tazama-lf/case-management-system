import { ApiProperty } from '@nestjs/swagger';

class CaseDetails {
  @ApiProperty({ type: 'number' })
  case_id: number;

  @ApiProperty({ type: 'string' })
  status: string;

  @ApiProperty({ type: 'string' })
  priority: string;

  @ApiProperty({ type: 'string' })
  case_type: string;
}

class AlertDetails {
  @ApiProperty({ type: 'number' })
  alert_id: number;

  @ApiProperty({ type: 'number' })
  case_id: number;
}

export class ManualCaseCreatedResponseDto {
  @ApiProperty({ type: 'boolean', example: true })
  success: boolean;

  @ApiProperty({ type: CaseDetails })
  case: CaseDetails;

  @ApiProperty({ type: AlertDetails })
  alert: AlertDetails;
}
