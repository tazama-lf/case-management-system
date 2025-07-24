<<<<<<< HEAD
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

  @IsString()
  source: string; // <-- Added for alert source
}

export class SubmitAlertDto {
  @IsObject()
  @ValidateNested()
  @Type(() => AlertResultDto)
  result: AlertResultDto;
=======
export class SubmitAlertDto {
  tenant_id: string;
  priority: 'High' | 'Medium' | 'Low';
  txtp: string;
  source: string;
  message: string;
  alert_data: {
    is_true_positive: boolean;
    aml_suspected: boolean;
    [key: string]: any;
  };
  transaction: object | null;
  network_map: object;
  confidence_per: number;
>>>>>>> 875cecd (feat(core): init NestJS with triage mock API)
}
