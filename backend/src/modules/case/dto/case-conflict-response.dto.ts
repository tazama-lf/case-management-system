import { ApiProperty } from '@nestjs/swagger';

class IncompleteTaskDto {
  @ApiProperty({ type: 'number', example: 123 })
  taskId: number;

  @ApiProperty({ type: 'string' })
  name: string;

  @ApiProperty({ type: 'string' })
  status: string;
}

export class CaseConflictResponseDto {
  @ApiProperty({ type: 'string', description: 'Error message' })
  message: string;

  @ApiProperty({ type: 'string', description: 'Current status of the case' })
  currentStatus: string;

  @ApiProperty({ type: 'string', description: 'Required status for this operation' })
  requiredStatus: string;

  @ApiProperty({ type: 'number', example: 123, description: 'Case ID' })
  caseId: number;

  @ApiProperty({
    type: [IncompleteTaskDto],
    required: false,
    description: 'List of incomplete tasks (if applicable)',
  })
  incompleteTasks?: IncompleteTaskDto[];
}
