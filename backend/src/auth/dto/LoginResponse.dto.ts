import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token!: string;

  @ApiProperty({ example: 3600, required: false, nullable: true })
  expiresIn!: number | null | undefined;
}
