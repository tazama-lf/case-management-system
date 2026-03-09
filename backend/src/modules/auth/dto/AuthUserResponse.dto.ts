import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'c98db341-beb6-457c-98e0-406cc1c71662' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'karen.mworia' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'Karen' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Mworia' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: 'karen.mworia@cms.org' })
  @IsString()
  email!: string;

  @ApiProperty({ type: [String], example: ['CMS_INVESTIGATOR'] })
  @IsString({ each: true })
  roles!: string[];
}
