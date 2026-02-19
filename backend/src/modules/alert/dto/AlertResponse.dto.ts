import { ApiProperty } from '@nestjs/swagger';

/**
 * Individual alert data structure in response
 */
export class AlertDto {
  @ApiProperty({
    description: 'AlertId of the alert to triage',
    example: 123
  })
  alert_id: number;

  @ApiProperty({
    description: 'Alert priority level',
    example: 'URGENT',
    enum: ['NEW', 'URGENT', 'CRITICAL', 'BREACH'],
    nullable: true
  })
  priority: string | null;

  @ApiProperty({
    description: 'Type of alert',
    example: 'FRAUD',
    nullable: true
  })
  alert_type: string | null;

  @ApiProperty({
    description: 'Alert source',
    example: 'TMS',
    nullable: true
  })
  source: string | null;

  @ApiProperty({
    description: 'Transaction type',
    example: 'pacs.008.001.10',
    nullable: true
  })
  txtp: string | null;

  @ApiProperty({
    description: 'Alert data as JSON',
    example: { status: 'active', details: 'High risk transaction' }
  })
  alert_data: any;

  @ApiProperty({
    description: 'Transaction data as JSON',
    example: { amount: 1000, currency: 'USD' }
  })
  transaction: any;

  @ApiProperty({
    description: 'Confidence percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 85
  })
  confidence_per: number;

  @ApiProperty({
    description: 'Alert creation timestamp',
    format: 'date-time',
    example: '2023-12-01T10:30:00Z'
  })
  created_at: Date;
}

/**
 * Pagination metadata for alert responses
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Total number of alerts',
    example: 150
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 15
  })
  totalPages: number;
}

/**
 * Response DTO that matches the actual service response structure
 * (with 'data' field and flattened pagination)
 */
export class AlertServiceResponseDto {
  @ApiProperty({
    description: 'Array of alert objects',
    type: [AlertDto]
  })
  data: AlertDto[];

  @ApiProperty({
    description: 'Current page number',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of alerts',
    example: 150
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 15
  })
  totalPages: number;
}

/**
 * Complete response structure for alert list endpoint
 * (with 'alerts' field and nested pagination - for API documentation)
 */
export class AlertResponseDto {
  @ApiProperty({
    description: 'Array of alert objects',
    type: [AlertDto]
  })
  alerts: AlertDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto
  })
  pagination: PaginationDto;
}