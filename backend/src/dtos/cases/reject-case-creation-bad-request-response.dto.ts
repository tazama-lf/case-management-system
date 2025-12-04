import { ApiProperty } from '@nestjs/swagger';

export class RejectCaseCreationBadRequestResponseDto {
  @ApiProperty({ 
    type: 'string', 
    example: 'Rejection reason is required and must be at least 10 characters' 
  })
  message: string;
}
