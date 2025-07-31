import { IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';

class AlertResultDto {
  @IsString()
  message: string;

  @IsObject()
  report: Prisma.JsonObject;

  @IsObject()
  transaction: Prisma.JsonObject;

  @IsObject()
  networkMap: Prisma.JsonObject;
}

export class SubmitAlertDto {
  @ValidateNested()
  @Type(() => AlertResultDto)
  result: AlertResultDto;
}
