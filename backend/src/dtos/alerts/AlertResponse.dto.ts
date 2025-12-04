import { ApiProperty } from '@nestjs/swagger';

export class AlertDto {
  @ApiProperty({
    description: 'Unique identifier for the alert',
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  alert_id: string;

  @ApiProperty({
    description: 'Alert message',
    type: 'string',
    example: 'Suspicious transaction detected'
  })
  message: string;

  @ApiProperty({
    description: 'Priority level of the alert',
    type: 'string',
    example: 'URGENT'
  })
  priority: string;

  @ApiProperty({
    description: 'Type of alert',
    type: 'string',
    example: 'FRAUD_DETECTION'
  })
  alert_type: string;

  @ApiProperty({
    description: 'Confidence percentage',
    type: 'number',
    example: 85.5
  })
  confidence_per: number;

  @ApiProperty({
    description: 'Creation timestamp',
    type: 'string',
    format: 'date-time',
    example: '2024-12-04T10:30:00Z'
  })
  created_at: string;
}

export class PaginationDto {
  @ApiProperty({
    description: 'Total number of items',
    type: 'number',
    example: 100
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    type: 'number',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    type: 'number',
    example: 10
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    type: 'number',
    example: 10
  })
  totalPages: number;
}

export class AlertResponseDto {
  @ApiProperty({
    description: 'List of alerts',
    type: [AlertDto]
  })
  alerts: AlertDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto
  })
  pagination: PaginationDto;
}
