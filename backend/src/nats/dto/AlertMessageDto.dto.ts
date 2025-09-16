import { IsOptional, IsString, IsNumber, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';
import { TransactionDTO } from './Transaction.dto';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export class AlertMessageDto {
  @IsString()
  tenant_id: string;

  @IsOptional()
  @IsEnum(Priority)
  @Type(() => String)
  priority?: Priority;

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

  @IsNumber()
  confidence_per: number;

  @IsOptional()
  aml_suspected?: boolean;

  @IsOptional()
  @IsString()
  case_id?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
