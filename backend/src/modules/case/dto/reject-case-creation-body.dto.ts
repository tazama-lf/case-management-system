import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectCaseCreationBodyDto {
  @ApiProperty({
    type: 'string',
    description: 'Reason for rejecting the case creation (minimum 10 characters)',
    example: 'Missing critical information about the alert source and transaction details',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  reason: string;
}
