import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterReferenceIdDto {
  @IsString()
  @ApiProperty({ description: 'Tenant ID', example: 'pacs.008.01.12' })
  txTp: string;

  @IsString()
  @ApiProperty({ description: 'Reference ID Name', example: 'EndToEndId' })
  referenceIdName: string;
}
