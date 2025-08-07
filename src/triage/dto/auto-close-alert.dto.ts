import { IsEnum } from 'class-validator';
import { AlertStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class AutoCloseAlertDto {
  @IsEnum(AlertStatus)
  @Type(() => String)
  status: AlertStatus;
}
