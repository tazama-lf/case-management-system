import { ApiProperty } from '@nestjs/swagger';

export class QueryResponseDto {
  @ApiProperty({
    description: 'Response status',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  code: number;

  @ApiProperty({
    description: 'The table name queried',
    example: 'alerts_kpi',
  })
  table: string;

  @ApiProperty({
    description: 'Number of records returned in this batch',
    example: 2,
  })
  row_count: number;

  @ApiProperty({
    description: 'Array of records formatted as JSON objects',
    example: [
      {
        alert_id: 4,
        tenant_id: 'DEFAULT',
        event_date: '2026-01-02',
        is_false_positive: 1,
      },
    ],
  })
  data: Array<Record<string, unknown>>;
}
