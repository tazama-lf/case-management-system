import { ApiProperty } from '@nestjs/swagger';
import { AlertType, PredictionOutcome } from '@prisma/client';
import { NetworkMap } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { TransactionDTO } from 'src/nats/dto/Transaction.dto';

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

  @IsString()
  @ApiProperty({
    description: 'Priority',
    example: 'NEW',
  })
  @IsOptional()
  priority?: string;

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
  alertData: Alert;

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
  @IsOptional()
  confidencePer?: number;

  @IsString()
  @ApiProperty({
    description: 'Case ID associated with the alert',
    example: 'a8b7cd6c-7caf-4c4e-9a09-23bffa944160',
  })
  caseId?: string;
}

//   const newAlert = await this.prisma.alert.create({
//     data: {
//       tenant_id: tenantId,
//       priority: Priority.NEW,
//       source: source,
//       txtp: txtp,
//       message: String(alert.message),
//       alert_data: JSON.parse(JSON.stringify(alert.report)),
//       transaction: JSON.parse(JSON.stringify(alert.transaction)),
//       network_map: JSON.parse(JSON.stringify(alert.networkMap)),
//       confidence_per: 0,
//     },
