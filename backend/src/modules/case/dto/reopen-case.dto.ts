import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RejectCaseReopeningDto {
  @ApiProperty({
    description: 'Detailed reason for rejecting the case reopening request (minimum 20 characters)',
    example: 'The new evidence provided does not warrant reopening this case. The information was already considered during the original investigation.',
    minLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'Rejection reason must be at least 20 characters' })
  rejectionReason: string;
}

export class RequestReopenCaseDto {
  @ApiProperty({
    description: 'Reason for requesting the case to be reopened',
    example: 'New evidence has come to light that could change the outcome of the case.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}