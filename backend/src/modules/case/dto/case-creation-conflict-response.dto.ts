import { ApiProperty } from '@nestjs/swagger';

export class CaseCreationConflictResponseDto {
  @ApiProperty({ type: 'string', example: 'Case is not pending creation approval' })
  message: string;

  @ApiProperty({ type: 'string', example: 'STATUS_00_DRAFT' })
  currentStatus: string;

  @ApiProperty({ type: 'string', example: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' })
  requiredStatus: string;
}
