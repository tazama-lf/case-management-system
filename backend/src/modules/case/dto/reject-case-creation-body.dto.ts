import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectCaseCreationBodyDto {
  @ApiProperty({
    type: 'string',
    description: 'Reason for rejecting the case creation (minimum 4 characters)',
    example: 'Missing critical information about the alert source and transaction details',
    minLength: 4,
  })
  @IsString()
  @MinLength(4, { message: 'Rejection reason must be at least 4 characters' })
  @MaxLength(500)
  reason: string;
}
