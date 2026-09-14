import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnblockCaseInvestigatorDto {
  @ApiProperty({
    description:
      'Reason for unblocking (minimum 4 characters). Mandatory. Does NOT grant access back — a new task assignment is still required for this person to reappear on the whitelist.',
    example: 'Investigation cleared them of the conflict.',
    minLength: 4,
    maxLength: 1000,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Reason for unblocking is required' })
  @MinLength(4, { message: 'Reason must be at least 4 characters long' })
  @MaxLength(1000)
  reason: string;
}
