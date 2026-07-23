import { IsString, IsOptional, IsObject, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryRequestDto {
  @ApiProperty({
    description: 'The table to query (e.g., alerts, transactions, cases)',
    example: 'alerts',
  })
  @IsString()
  @IsNotEmpty()
  table_name: string;

  @ApiProperty({
    description: 'Key-Value pairs for filtering. Keys must match table columns.',
    example: { risk_level: 'HIGH' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiProperty({
    description: 'Specific fields to return. If omitted, all columns are returned.',
    example: ['alert_id', 'alert_date', 'risk_level'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  columns?: string[];

  @ApiProperty({
    description: 'Max number of rows (Default: 100)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
