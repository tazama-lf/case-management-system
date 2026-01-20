import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ example: 'investigator'})
  username!: string;

  @ApiProperty({ example: 'abc.123'})
  password!: string;
}
