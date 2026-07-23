import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RequestAbandonCaseDto {
  @ApiProperty({
    description: 'Reason for abandoning the case',
    example: 'The case is being abandoned due to lack of evidence.',
  })
  @IsString()
  reason: string;
}
