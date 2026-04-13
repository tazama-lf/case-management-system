import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject } from 'class-validator';

export class DetectedAnomalyDto {
  @ApiProperty({ description: 'Date of anomaly', example: '2025-11-01' })
  @IsString()
  date: string;

  @ApiProperty({ description: 'Type of transaction', example: 'Transfer' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Amount involved', example: 8000 })
  amount: number;

  @ApiProperty({ description: 'Description of anomaly', example: 'Large cross-border transfer flagged' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Risk level', example: 'High' })
  @IsString()
  risk: 'High' | 'Medium' | 'Low';
}

export class TransactionRecordDto {
  tx_msg_id: number;
  event_date: string; // ISO date
  tx_amount: number;
  tx_ccy: string;
  tx_type: string;
  is_alerted: number;
  is_investigated: number;
  cum_tx_count: number;
  cum_tx_amount: number;
  entity_role: string;
  entity_id: string;
  entity_type: string;

  // optional depending on query
  debtor_name?: string;
  creditor_name?: string;
}

export class SqlResponseDto {
  status: string;
  code: number;
  query: string;
  row_count: number;
  data: TransactionRecordDto[];
}

export class GenerateProfileResponseDto {
  @ApiProperty({ description: 'Tenant ID for this transaction profile' })
  @IsString()
  tenantId: string;
  @ApiProperty({ description: 'SQL response for creditor transactions' })
  @IsObject()
  transactionCreditorResp: SqlResponseDto;
  @ApiProperty({ description: 'SQL response for debtor transactions' })
  @IsObject()
  transactionDebtorResp: SqlResponseDto;
}

// export class ProfileResponseDto {
//   @ApiProperty({ description: 'Tenant ID for this transaction profile' })
//   @IsString()
//   tenantId: string;

//   @ApiProperty({ description: 'Filters used for profile generation', required: false, type: Object })
//   @IsOptional()
//   @IsObject()
//   filters?: Record<string, any>;

//   @ApiProperty({ description: 'Calculated metrics (total volume, average ticket size, deviation percentages)', type: Object })
//   @IsObject()
//   metrics: Record<string, any>;

//   @ApiProperty({ description: 'Outlier transactions and sudden changes', type: Object, required: false })
//   @IsOptional()
//   @IsObject()
//   outliers?: Record<string, any>;

//   @ApiProperty({ description: 'Summary table of key metrics', type: Object, required: false })
//   @IsOptional()
//   @IsObject()
//   summaryTable?: Record<string, any>;

//   @ApiProperty({ description: 'Investigator interpretation notes', required: false })
//   @IsOptional()
//   @IsString()
//   notes?: string;

//   @ApiProperty({ description: 'Visualization placeholder (e.g., chart config)', required: false })
//   @IsOptional()
//   @IsString()
//   visualization?: string;

//   @ApiProperty({
//     description: 'Detected anomalies and flagged patterns',
//     type: [DetectedAnomalyDto],
//     required: false,
//     example: [
//       { date: '2025-11-01', type: 'Transfer', amount: 8000, description: 'Large cross-border transfer flagged', risk: 'High' },
//       { date: '2025-09-15', type: 'Transfer', amount: 5000, description: 'Unusual peer comparison', risk: 'Medium' },
//     ],
//   })
//   @IsOptional()
//   @IsArray()
//   detectedAnomalies?: DetectedAnomalyDto[];

//   @ApiProperty({
//     description: 'Formatted transaction list for table display',
//     required: false,
//     type: [Object],
//     example: [
//       {
//         'Date': '2025-09-01',
//         'Transaction ID': 'TX10001',
//         'Type': 'TRANSFER',
//         'Account': 'A1001',
//         'Counterparty': 'A1002',
//         'Role': 'Debtor',
//         'Amount': '1000.00',
//       },
//     ],
//   })
//   @IsOptional()
//   @IsArray()
//   transactionTable?: Array<Record<string, any>>;
// }
