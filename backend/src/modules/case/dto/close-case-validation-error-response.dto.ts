import { ApiProperty } from '@nestjs/swagger';

export class CloseCaseValidationErrorResponseDto {
  @ApiProperty({ type: 'string', description: 'Error message' })
  message: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    example: ['Final notes are required and must be at least 20 characters'],
    description: 'List of validation errors'
  })
  errors: string[];

  @ApiProperty({ type: 'number', example: 124, description: 'Case ID' })
  caseId: number;
}
