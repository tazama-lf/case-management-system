import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionDTO } from 'src/nats/dto/Transaction.dto';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export class CreateNaltAlertDto {
  @ApiProperty({
    description: 'Alert message describing the incident',
    example: 'Customer reported suspicious transaction',
    type: 'string',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Alert report object (status will be automatically set to NALT)',
    type: 'object',
    additionalProperties: true,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      cfg: '1.0.0',
      typologyResult: [],
    },
  })
  @IsObject()
  report: any;

  @ApiProperty({
    description: 'Transaction details',
    type: 'object',
    additionalProperties: true,
    example: {
      TxTp: 'pain.001.001.11',
      CreDtTm: '2024-01-15T10:30:00.000Z',
      Amt: {
        Amt: 1000,
        Ccy: 'USD',
      },
    },
  })
  @IsObject()
  transaction: TransactionDTO;

  @ApiProperty({
    description: 'Network map data',
    type: 'object',
    additionalProperties: true,
    example: {
      messages: [],
      edges: [],
    },
  })
  @IsObject()
  networkMap: NetworkMap;
}
