import { ApiProperty } from '@nestjs/swagger';

export class CaseNotFoundResponseDto {
  @ApiProperty({ type: 'number', example: 404 })
  statusCode: number;

  @ApiProperty({ type: 'string', example: 'Case not found or you don\'t have permission to close it' })
  message: string;
}
