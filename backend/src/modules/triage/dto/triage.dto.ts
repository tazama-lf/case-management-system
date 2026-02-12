import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject, IsString } from 'class-validator';

export class HealthCheckResponseDTO {
  @ApiProperty({
    description: 'Health status indicator',
    example: 'ok',
    type: 'string',
  })
  status: string;
}

export class AlertTriageResponseDTO {
  @ApiProperty({
    description: 'Alert unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  alert_id: string;

  @ApiProperty({
    description: 'Alert status after triage',
    example: 'TRIAGED',
    type: 'string',
  })
  status: string;

  @ApiProperty({
    description: 'Alert priority level',
    example: 'URGENT',
    type: 'string',
  })
  priority: string;

  @ApiProperty({
    description: 'Confidence percentage (0-100)',
    example: 85.5,
    type: 'number',
    minimum: 0,
  })
  confidence_per: number;

  @ApiProperty({
    description: 'Timestamp when alert was last updated',
    example: '2024-12-03T10:30:00Z',
    format: 'date-time',
  })
  updated_at: string;
}
