import {
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, AlertStatus } from '@prisma/client';

export class AlertMessageDto {
  @IsString()
  tenant_id: string;

  @IsOptional()
  @IsEnum(Priority)
  @Type(() => String)
  priority?: Priority;

  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  txtp?: string;

  @IsString()
  message: string;

  @IsObject()
  alert_data: object;

  @IsObject()
  transaction: object;

  @IsObject()
  network_map: object;

  @IsOptional()
  @IsEnum(AlertStatus)
  @Type(() => String)
  alert_status?: AlertStatus;

  @IsNumber()
  confidence_per: number;

  @IsOptional()
  @IsString()
  case_id?: string;
  @IsOptional()
  @IsString()
  userId?: string;
}
