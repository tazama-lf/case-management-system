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

  // @IsString()
  // source: string;
  // @IsString()
  // txtp: string;
}

export class SubmitAlertDto {
  @IsObject()
  @ValidateNested()
  @Type(() => AlertResultDto)
  result: AlertResultDto;
}
