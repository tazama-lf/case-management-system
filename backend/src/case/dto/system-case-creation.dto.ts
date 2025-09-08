import { IsString, IsUUID, IsEnum, IsOptional, IsObject, IsNumber, Min, Max, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Priority, CaseType, AlertType } from '@prisma/client';

/**
 * DTO for Alert Data within the system transmission payload
 */
class AlertDataDto {
  @ApiProperty({ description: 'Typology that triggered the alert' })
  @IsString()
  @IsNotEmpty()
  typology: string;

  @ApiProperty({ description: 'Risk score', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore: number;

  @ApiProperty({ description: 'Indicators that triggered the alert' })
  @IsObject()
  indicators: Record<string, any>;

  @ApiProperty({ description: 'Rule results' })
  @IsObject()
  @IsOptional()
  ruleResults?: Record<string, any>;
}

/**
 * DTO for Transaction Data
 */
class TransactionDataDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Debtor information' })
  @IsObject()
  debtor: Record<string, any>;

  @ApiProperty({ description: 'Creditor information' })
  @IsObject()
  creditor: Record<string, any>;

  @ApiProperty({ description: 'Transaction timestamp' })
  @IsString()
  timestamp: string;

  @ApiProperty({ description: 'Transaction type (pain.001, pacs.008, etc.)' })
  @IsString()
  @IsOptional()
  transactionType?: string;
}

/**
 * Main DTO for system-to-system case creation
 * Based on User Story #185 requirements
 */
export class SystemCaseCreationDto {
  @ApiProperty({
    description: 'Tenant ID for multi-tenant support',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    description: 'System identifier (from payload)',
    example: 'TADProc-001',
    required: false,
  })
  @IsString()
  @IsOptional()
  systemIdentifier?: string;

  @ApiProperty({
    description: 'Priority level',
    enum: Priority,
    default: Priority.NEW,
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority = Priority.NEW;

  @ApiProperty({
    description: 'Case type',
    enum: CaseType,
    required: false,
  })
  @IsEnum(CaseType)
  @IsOptional()
  caseType?: CaseType;

  @ApiProperty({
    description: 'Alert type',
    enum: AlertType,
    required: false,
  })
  @IsEnum(AlertType)
  @IsOptional()
  alertType?: AlertType;

  @ApiProperty({
    description: 'Report status (only ALRT accepted, NALT dropped)',
    example: 'ALRT',
  })
  @IsString()
  @IsOptional()
  reportStatus?: string;

  @ApiProperty({
    description: 'Alert message',
    example: 'Suspicious transaction detected',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({
    description: 'Source system',
    example: 'TAZAMA',
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'pacs.008',
  })
  @IsString()
  @IsOptional()
  transactionType?: string;

  @ApiProperty({
    description: 'Alert data containing typology and risk information',
    type: AlertDataDto,
  })
  @ValidateNested()
  @Type(() => AlertDataDto)
  alertData: AlertDataDto;

  @ApiProperty({
    description: 'Transaction data',
    type: TransactionDataDto,
  })
  @ValidateNested()
  @Type(() => TransactionDataDto)
  transaction: TransactionDataDto;

  @ApiProperty({
    description: 'Network map data',
    required: false,
  })
  @IsObject()
  @IsOptional()
  networkMap?: Record<string, any>;

  @ApiProperty({
    description: 'Confidence percentage',
    minimum: 0,
    maximum: 100,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  confidencePercentage?: number;
}
