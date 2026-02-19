import { ApiProperty } from '@nestjs/swagger';

export class SystemCaseCreatedResponseDto {
  @ApiProperty({
    type: 'number',
    description: 'CaseId of the created case',
    example: 1234
  })
  caseId: number;

  @ApiProperty({
    type: 'string',
    description: 'Current status of the case',
    example: 'STATUS_00_DRAFT'
  })
  status: string;
}