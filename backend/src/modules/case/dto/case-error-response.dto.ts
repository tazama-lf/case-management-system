import { ApiProperty } from '@nestjs/swagger';

export class CaseErrorResponseDto {
  @ApiProperty({ type: 'string', example: 'System error occurred during case closure' })
  message: string;

  @ApiProperty({ type: 'string', description: 'Case ID' })
  caseId: string;

  @ApiProperty({ type: 'string', description: 'Error details' })
  error: string;

  @ApiProperty({ type: 'string', format: 'date-time' })
  timestamp: string;

  @ApiProperty({ type: 'string', example: 'approveCaseClosure', required: false })
  action?: string;
}
