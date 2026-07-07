import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject, IsString } from 'class-validator';

export class AlertDetailsResponseDTO {
  @ApiProperty({
    description: 'Alert Id',
    example: '123',
  })
  @IsNumber()
  alert_id: number;

  @ApiProperty({
    description: 'Alert message or description',
    example: 'Suspicious transaction detected',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Alert priority level',
    example: 'URGENT',
  })
  @IsString()
  priority: string;

  @ApiProperty({
    description: 'Type of alert (FRAUD, AML, etc.)',
    example: 'FRAUD',
  })
  @IsString()
  alert_type: string;

  @ApiProperty({
    description: 'Confidence percentage (0-100)',
    example: 85.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  confidence_per: number;

  @ApiProperty({
    description: 'Associated case ID if case was created. For FRAUD_AND_AML alerts this is the primary (FRAUD) case.',
    example: 987,
    nullable: true,
    required: false,
  })
  @IsNumber()
  case_id?: number;

  @ApiProperty({
    description: 'For FRAUD_AND_AML alerts, the sibling AML case sharing the same investigation group',
    example: 988,
    nullable: true,
    required: false,
  })
  @IsNumber()
  related_case_id?: number;

  @ApiProperty({
    description: 'Case type of the related case (e.g. AML)',
    example: 'AML',
    nullable: true,
    required: false,
  })
  @IsString()
  related_case_type?: string;

  @ApiProperty({
    description: 'Alert-specific data and metadata',
    example: {
      ruleId: 'RULE_001',
      threshold: 1000,
      actualAmount: 1500,
    },
  })
  @IsObject()
  alert_data: Record<string, any>;

  @ApiProperty({
    description: 'Transaction data that triggered the alert',
    example: {
      transactionId: 'TXN_123456',
      amount: 1500,
      currency: 'USD',
      fromAccount: 'ACC_001',
      toAccount: 'ACC_002',
    },
  })
  @IsObject()
  transaction_data: Record<string, any>;

  @ApiProperty({ description: 'Network analysis and mapping data' })
  network_map: Record<string, any>;

  @ApiProperty({
    description: 'Timestamp when alert was created',
    example: '2024-12-03T09:00:00Z',
    format: 'date-time',
  })
  created_at: string;

  @ApiProperty({
    description: 'Timestamp when alert was last updated',
    example: '2024-12-03T10:30:00Z',
    format: 'date-time',
  })
  updated_at: string;
}
