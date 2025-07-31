import { Priority } from '@prisma/client';
import { IsOptional, IsEnum, IsNumber } from 'class-validator';

export class UpdateAlertDto {
  @IsOptional()
  @IsNumber()
  confidence_per?: number;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
