import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateProfileDto {
  @ApiProperty({ description: 'Tenant ID for which to generate the transaction profile' })
  @IsString()
  tenantId!: string;
}
