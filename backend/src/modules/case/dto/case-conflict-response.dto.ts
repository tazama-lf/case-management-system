import { ApiProperty } from '@nestjs/swagger';

class IncompletTaskDto {
  @ApiProperty({ type: 'string' })
  taskId: string;

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

  @ApiProperty({ type: 'string', description: 'Case ID' })
  caseId: string;

  @ApiProperty({
    type: [IncompletTaskDto],
    required: false,
    description: 'List of incomplete tasks (if applicable)',
  })
  incompleteTasks?: IncompletTaskDto[];
}
