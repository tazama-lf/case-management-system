import { ApiProperty } from '@nestjs/swagger';

export class SimpleMessageResponseDto {
  @ApiProperty({ type: 'string', example: 'Case not found' })
  message: string;
}
