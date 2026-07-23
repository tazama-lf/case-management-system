import { ApiProperty } from '@nestjs/swagger';

export class UserWorkloadResponseDto {
  @ApiProperty({ description: 'Total number of active cases', example: 15 })
  totalActiveCases: number;

  @ApiProperty({ description: 'Number of cases assigned to user', example: 8 })
  assignedCases: number;

  @ApiProperty({ description: 'Number of unassigned cases', example: 7 })
  unassignedCases: number;

  @ApiProperty({ description: 'Number of pending tasks', example: 12 })
  pendingTasks: number;

  @ApiProperty({ description: 'Number of overdue tasks', example: 3 })
  overdueTasks: number;
}
