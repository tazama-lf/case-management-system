import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class GenerateProfileDto {
  @ApiProperty({ description: 'Tenant ID for which to generate the transaction profile' })
  @IsString()
  tenantId: string;

  @ApiProperty({
    description: 'Filters for transaction profile (date range, channel, transaction type, geography, account, role)',
    required: false,
    type: Object,
    example: {
      dateFrom: '2025-09-01',
      dateTo: '2025-11-30',
      channel: 'Online',
      type: 'Transfer',
      geography: 'Cross-border',
      account: 'ACC-1234',
      role: 'Creditor',
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
    account?: string;
    role?: string;
    creditorId?: string;
    debtorId?: string;
  };

  @ApiProperty({ description: 'Investigator interpretation notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
