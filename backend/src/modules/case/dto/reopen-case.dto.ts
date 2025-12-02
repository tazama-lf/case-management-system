import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Min, Max, MaxLength } from 'class-validator';

export class RejectCaseReopeningDto {
  @ApiProperty({
    description: 'Detailed reason for rejecting the case reopening request (minimum 4 characters)',
    example: 'The new evidence provided does not warrant reopening this case. The information was already considered during the original investigation.',
    minLength: 4,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4, { message: 'Rejection reason must be at least 4 characters' })
  rejectionReason: string;
}

export class RequestReopenCaseDto {
  @ApiProperty({
    description: 'Reason for requesting the case to be reopened',
    example: 'New evidence has come to light that could change the outcome of the case.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(500)
  reason: string;
}