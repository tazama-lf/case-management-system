import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'c98db341-beb6-457c-98e0-406cc1c71662' })
  id!: string;

  @ApiProperty({ example: 'karen.mworia' })
  username!: string;

  @ApiProperty({ example: 'Karen' })
  firstName!: string;

  @ApiProperty({ example: 'Mworia' })
  lastName!: string;

  @ApiProperty({ example: 'karen.mworia@cms.org' })
  email!: string;

  @ApiProperty({ type: [String], example: ['CMS_INVESTIGATOR'] })
  roles!: string[];
}
