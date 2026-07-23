import { ApiProperty } from '@nestjs/swagger';

export class AlertActionHistoryDTO {
  @ApiProperty({
    description: 'Action unique identifier',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  action_id: string;

  @ApiProperty({
    description: 'Type of action performed',
    example: 'MANUAL_TRIAGE',
    type: 'string',
  })
  action_type: string;

  @ApiProperty({
    description: 'User who performed the action',
    example: '789e0123-e89b-12d3-a456-426614174002',
    format: 'uuid',
  })
  user_id: string;

  @ApiProperty({
    description: 'Action note or comment',
    example: 'Updated priority based on additional investigation',
    type: 'string',
  })
  note: string;

  @ApiProperty({
    description: 'Timestamp when action was performed',
    example: '2024-12-03T10:30:00Z',
    format: 'date-time',
  })
  created_at: string;
}
