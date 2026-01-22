import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterReferenceIdDto {
  @IsString()
  @ApiProperty({ description: 'Tenant ID', examples: ['pacs.008.01.10', 'pacs.002.01.12'] })
  txTp: string;

  @IsString()
  @ApiProperty({ description: 'Reference ID Name', examples: ['EndToEndId', 'OrgnlEndToEndId'] })
  referenceIdName: string;
}
