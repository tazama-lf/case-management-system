import { ApiProperty } from '@nestjs/swagger';

export class CaseReopeningConflictResponseDto {
  @ApiProperty({ type: 'string', description: 'Error message' })
  message: string;

  @ApiProperty({ type: 'string', description: 'Current status of the case' })
  currentStatus: string;

  @ApiProperty({ type: 'string', example: 'STATUS_31_REOPENED' })
  requiredStatus: string;

  @ApiProperty({ type: 'number', example: 123 })
  caseId: number;
}
