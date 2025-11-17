import { ApiProperty } from '@nestjs/swagger';

export class CaseMissingFieldsResponseDto {
  @ApiProperty({ type: 'string', example: 'Case has missing required fields' })
  message: string;

  @ApiProperty({ 
    type: 'array',
    items: { type: 'string' },
    example: ['priority', 'case_type'],
    description: 'List of missing fields'
  })
  missingFields: string[];
}
