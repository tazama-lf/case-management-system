import { IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionDTO } from 'src/dtos/Transaction.dto';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export class IngestAlertDto {
  @ApiProperty({
    description: 'Alert message',
    example: 'Suspicious transaction detected',
    type: 'string',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Alert report object',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  report: Alert;

  @ApiProperty({
    description: 'Transaction details',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  transaction: TransactionDTO;

  @ApiProperty({
    description: 'Network map data',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  networkMap: NetworkMap;
}
