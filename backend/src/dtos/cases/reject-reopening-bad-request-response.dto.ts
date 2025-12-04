import { ApiProperty } from '@nestjs/swagger';

export class RejectReopeningBadRequestResponseDto {
  @ApiProperty({ type: 'number', example: 400 })
  statusCode: number;

  @ApiProperty({ type: 'string', example: 'Rejection reason must be at least 4 characters' })
  message: string;

  @ApiProperty({ type: 'string', example: 'Bad Request' })
  error: string;
}
