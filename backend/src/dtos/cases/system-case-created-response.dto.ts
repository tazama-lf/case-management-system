import { ApiProperty } from '@nestjs/swagger';

export class SystemCaseCreatedResponseDto {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'UUID of the created case' })
  caseId: string;

  @ApiProperty({ type: 'string', description: 'Current status of the case' })
  status: string;
}
