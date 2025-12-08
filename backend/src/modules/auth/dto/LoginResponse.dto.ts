import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginResponseDto {
  @ApiProperty({ example: 'Login successful' })
  @IsString()
  message!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 3600, required: false, nullable: true })
  expiresIn!: number | null | undefined;
}
