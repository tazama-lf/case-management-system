import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

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
    description: 'Alert Id',
    example: 123,
  })
  @IsNumber()
  alert_id: number;

  @ApiProperty({
    description: 'Alert status after triage',
    example: 'TRIAGED',
    type: 'string',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Alert priority level',
    example: 'URGENT',
    type: 'string',
  })
  @IsString()
  priority: string;

  @ApiProperty({
    description: 'Confidence percentage (0-100)',
    example: 85.5,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  confidence_per: number;

  @ApiProperty({
    description: 'Timestamp when alert was last updated',
    example: '2024-12-03T10:30:00Z',
    format: 'date-time',
  })
  @IsString()
  updated_at: string;
}
