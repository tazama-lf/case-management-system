import { IsString, IsUUID } from 'class-validator';

export class TransactionDTO {
  @IsUUID()
  TenantId: string;

  @IsString()
  TxTp: string;
}