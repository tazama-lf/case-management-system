import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeCaseInvestigatorDto {
  @ApiProperty({
    description:
      'Reason for revoking this investigator’s whitelist access (minimum 4 characters). Mandatory — plan .claude/plans/wild-dreaming-dewdrop.md §2.',
    example: 'No longer needed on this case; workload redistribution.',
    minLength: 4,
    maxLength: 1000,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Reason for revocation is required' })
  @MinLength(4, { message: 'Reason must be at least 4 characters long' })
  @MaxLength(1000)
  reason: string;
}
