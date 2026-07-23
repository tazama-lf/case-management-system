import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionDetailRecordDTO {
  @ApiProperty({ example: '20260403074933742' })
  @IsString()
  _hoodie_commit_time!: string;

  @ApiProperty({ example: '20260403074933742_0_186404' })
  @IsString()
  _hoodie_commit_seqno!: string;

  @ApiProperty({ example: 'ca1b0f29c81c0a37cd9d03e2434d1ba0b81d7da4e7fc5bf1977e9746dfbf94eb' })
  @IsString()
  _hoodie_record_key!: string;

  @ApiProperty({ example: '' })
  @IsString()
  _hoodie_partition_path!: string;

  @ApiProperty({ example: '4c77f9c9-525a-4208-bb59-f058dcf79824-0_0-333-1600_20260403081526754.parquet' })
  @IsString()
  _hoodie_file_name!: string;

  @ApiProperty({ example: 'ca1b0f29c81c0a37cd9d03e2434d1ba0b81d7da4e7fc5bf1977e9746dfbf94eb' })
  @IsString()
  pk!: string;

  @ApiProperty({ example: 500356 })
  @IsNumber()
  transaction_id!: number;

  @ApiProperty({ example: 'bdd9059b58e14839b076bbc6a4e0b94b' })
  @IsString()
  end_to_end_id!: string;

  @ApiProperty({ example: 'DEFAULT' })
  @IsString()
  tenant_id!: string;

  @ApiProperty({ example: 'DEFAULT' })
  @IsString()
  tx_tenant_id!: string;

  @ApiProperty({ example: 'pacs.002.001.12' })
  @IsString()
  tx_type!: string;

  @ApiProperty({ example: 'dc59c4728926413491d804e82a0dee41' })
  @IsString()
  tx_msg_id!: string;

  @ApiProperty({ example: '2025-12-30T02:24:21.778166' })
  @IsString()
  tx_event_ts!: string;

  @ApiProperty({ example: '2025-12-30' })
  @IsString()
  tx_event_date!: string;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  debtor_name!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  debtor_id!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  creditor_name!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  creditor_id!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  debtor_account_id!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  creditor_account_id!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsNumber()
  instructed_amount!: number | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  instructed_currency!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsNumber()
  interbank_settlement_amount!: number | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsString()
  interbank_settlement_currency!: string | null;

  @ApiProperty({ example: null, required: false })
  @IsOptional()
  @IsNumber()
  exchange_rate!: number | null;

  @ApiProperty({ example: 'fsp001' })
  @IsString()
  instg_mmb_id!: string;

  @ApiProperty({ example: 'fsp002' })
  @IsString()
  instd_mmb_id!: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  charge_count!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  charge_total_amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  charge_currency!: string;

  @ApiProperty({ example: 's3a://frms/transaction/' })
  @IsString()
  source_file_path!: string;

  @ApiProperty({ example: '3f19a2d08bc49b9fb062f2209fbbdf731ad0d66d5485f0caf39c63bdad218a8a' })
  @IsString()
  record_hash!: string;

  @ApiProperty({ example: '2026-04-03T07:49:33.778166' })
  @IsString()
  ingested_at_ts!: string;
}

export class transactionDataResponseDTO {
  @ApiProperty({ example: 'success' })
  @IsString()
  status!: string;

  @ApiProperty({ example: 200 })
  @IsNumber()
  code!: number;

  @ApiProperty({ example: 'transaction_detail' })
  @IsString()
  table!: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  row_count!: number;

  @ApiProperty({ type: [TransactionDetailRecordDTO] })
  @IsArray()
  @Type(() => TransactionDetailRecordDTO)
  data!: TransactionDetailRecordDTO[];
}
