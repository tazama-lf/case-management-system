import { ApiProperty } from '@nestjs/swagger';

export class ApproveCaseClosureBadRequestResponseDto {
  @ApiProperty({ type: 'string', description: 'Error message' })
  message: string;

  @ApiProperty({ type: 'string', description: 'The outcome provided in the request' })
  providedOutcome: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    example: ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'],
    description: 'List of valid outcomes',
  })
  validOutcomes: string[];

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    example: ['Completed investigation task', 'Investigation closure recommendation'],
    description: 'List of missing required information',
  })
  missingInformation: string[];
}
