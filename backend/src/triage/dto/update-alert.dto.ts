import { Priority, AlertType } from '@prisma/client';
import { IsOptional, IsEnum, IsNumber } from 'class-validator';

export class UpdateAlertDto {
  @IsOptional()
  @IsNumber()
  confidence_per?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;
}
