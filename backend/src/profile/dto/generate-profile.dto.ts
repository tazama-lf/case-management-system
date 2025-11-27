import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class GenerateProfileDto {
  @ApiProperty({ description: 'Case ID for which to generate the transaction profile' })
  @IsString()
  caseId: string;

  @ApiProperty({
    description: 'Filters for transaction profile (date range, channel, transaction type, geography, tenantId)',
    required: false,
    type: Object,
    example: {
      dateFrom: '2025-09-01',
      dateTo: '2025-11-30',
      channel: 'Online',
      type: 'Transfer',
      geography: 'Cross-border',
      tenantId: 'T001',
    },
  })
  @IsOptional()
  @IsObject()
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    channel?: string;
    type?: string;
    geography?: string;
    tenantId?: string;
    account?: string;
    role?: string;
  };

  @ApiProperty({ description: 'Investigator interpretation notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
