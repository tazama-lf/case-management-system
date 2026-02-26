import { ApiProperty } from '@nestjs/swagger';

export class TransactionDetailsDto {
  @ApiProperty({ description: 'Unique transaction identifier' })
  transactionId: string;

  @ApiProperty({ description: 'Transaction type' })
  transactionType: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({ description: 'Transaction currency', required: false })
  currency?: string;

  @ApiProperty({ description: 'Transaction date (YYYY-MM-DD)' })
  transactionDate: string;

  @ApiProperty({ description: 'Sender/Debtor identifier' })
  debtorId: string;

  @ApiProperty({ description: 'Receiver/Creditor identifier' })
  creditorId: string;

  @ApiProperty({ description: 'Tenant identifier', required: false })
  tenantId?: string;

  @ApiProperty({ description: 'Additional transaction data', required: false })
  additionalData?: Record<string, any>;
}
