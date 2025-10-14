import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionDTO } from '../../nats/dto/Transaction.dto';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export class SystemCaseCreationDto {
  @IsString()
  tenant_id: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  txtp?: string;

  @IsString()
  message: string;

  @ValidateNested()
  @Type(() => Alert)
  report: Alert;

  @ValidateNested()
  @Type(() => TransactionDTO)
  transaction: TransactionDTO;

  @ValidateNested()
  @Type(() => NetworkMap)
  networkMap: NetworkMap;

  @IsOptional()
  @IsString()
  case_id?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
