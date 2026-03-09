import { ApiProperty } from '@nestjs/swagger';

export class CaseNotFoundResponseDto {
  @ApiProperty({ type: 'number', example: 404 })
  statusCode: number;

  @ApiProperty({
    type: 'string',
    example: 'Case not found or you do not have permission to close it',
  })
  message: string;
}
