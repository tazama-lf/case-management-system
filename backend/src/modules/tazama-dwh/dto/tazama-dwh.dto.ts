import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';

export class TransactionDto {
  date: string | null; // creDtTm
  transactionId: string; // endToEndId
  type: string; // txTp
  account: string; // source OR destination (based on role)
  counterparty: string; // the opposite account
  role: 'DEBTOR' | 'CREDITOR';
  amount: number | null; // amt
  currency: string | null; // ccy
}

export class DWHAccountTransactionsResponseDto {
  accountId: string;
  tenantId: string;
  transactions: TransactionDto[];
}
