import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionDTO } from '../triage/Transaction.dto';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export class SystemCaseCreationDto {
  @ApiProperty({
    description: 'Case message describing the alert/incident',
    example: 'Suspicious transaction detected via system monitoring',
    type: 'string',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Alert report object containing detection details',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  report: Alert;

  @ApiProperty({
    description: 'Transaction details involved in the case',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  transaction: TransactionDTO;

  @ApiProperty({
    description: 'Network map data showing transaction relationships',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  networkMap: NetworkMap;

  @ApiProperty({
    description: 'Optional transaction type identifier',
    example: 'PAYMENT_TRANSFER',
    required: false,
    type: 'string',
  })
  @IsOptional()
  @IsString()
  txtp?: string;
}
