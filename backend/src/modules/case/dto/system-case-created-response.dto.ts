import { ApiProperty } from '@nestjs/swagger';

export class SystemCaseCreatedResponseDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    description: 'UUID of the created case',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  caseId: string;

  @ApiProperty({
    type: 'string',
    description: 'Current status of the case',
    example: 'STATUS_00_DRAFT',
  })
  status: string;
}
