import { IsString, IsNotEmpty, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlacklistCaseInvestigatorDto {
  @ApiProperty({
    description: 'UUID of the user to blacklist from this case',
    example: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
    format: 'uuid',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description:
      'Reason for blacklisting (minimum 4 characters) — e.g. conflict of interest, under investigation, HR flag, legal exclusion. Mandatory. Also revokes any live whitelist row for this user on this case, in the same transaction.',
    example: 'Conflict of interest — related party to this case.',
    minLength: 4,
    maxLength: 1000,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Reason for blacklisting is required' })
  @MinLength(4, { message: 'Reason must be at least 4 characters long' })
  @MaxLength(1000)
  reason: string;
}
