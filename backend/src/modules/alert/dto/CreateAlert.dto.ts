import { ApiProperty } from '@nestjs/swagger';
import { AlertType, PredictionOutcome, Priority } from '@prisma/client-cms';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { TransactionDTO } from 'src/dtos/Transaction.dto';

export class CreateAlertDTO {
  @IsString()
  @ApiProperty({
    description: 'Tenant identifier',
    example: 'DEFAULT',
  })
  tenantId: string;

  @IsString()
  @ApiProperty({
    description: 'Priority Score',
    example: 0.77,
  })
  @IsOptional()
  priority_score?: number;

  @IsEnum(Priority)
  @ApiProperty({
    description: 'Priority',
    example: Priority.URGENT,
  })
  @IsOptional()
  priority?: Priority;

  @IsEnum(AlertType)
  @ApiProperty({
    description: 'Type of the alert',
    example: AlertType.FRAUD,
  })
  @IsOptional()
  alertType?: AlertType;

  @IsEnum(PredictionOutcome)
  @ApiProperty({
    description: 'Prediction outcome of the alert',
    example: PredictionOutcome.TRUE_POSITIVE,
  })
  @IsOptional()
  predictionOutcome?: PredictionOutcome;

  @IsString()
  @ApiProperty({
    description: 'Source of the alert',
    example: 'NATS',
  })
  source: string;

  @IsString()
  @ApiProperty({
    description: 'Transaction Type',
    example: 'pacs.008.001.02',
  })
  txtp: string;

  @IsString()
  @ApiProperty({
    description: 'Alert message',
    example: 'Suspicious transaction detected',
  })
  message: string;

  @IsObject()
  @ApiProperty({
    description: 'Alert data object',
    type: 'object',
    additionalProperties: true,
  })
  report: Alert;

  @IsObject()
  @ApiProperty({
    description: 'Transaction details',
    type: 'object',
    additionalProperties: true,
  })
  transaction: TransactionDTO;

  @IsObject()
  @ApiProperty({
    description: 'Network map details',
    type: 'object',
    additionalProperties: true,
  })
  networkMap: NetworkMap;

  @IsNumber()
  @ApiProperty({
    description: 'Confidence percentage of the alert',
    example: 85,
  })
  confidencePer: number;

  @ApiProperty({
    description: 'Case ID associated with the alert',
    example: 12345,
  })
  caseId: number;
}
