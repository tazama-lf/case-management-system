import { IsString } from 'class-validator';

export class CloseAlertDto {
  @IsString()
  reason: string;
}
