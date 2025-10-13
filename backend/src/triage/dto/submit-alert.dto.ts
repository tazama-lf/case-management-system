import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionDTO } from 'src/nats/dto/Transaction.dto';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export class SubmitAlertDto {
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

  @ApiProperty({
    description: 'Confidence percentage (0-100)',
    example: 75.5,
    required: false,
    type: 'number',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  confidence_per?: number;
}