import { ApiProperty } from '@nestjs/swagger';

// Create Candidate Group DTO
export class CreateCandidateGroupDto {
  @ApiProperty({
    description: 'Unique identifier for the group',
    type: 'string',
    example: 'fraud-investigators',
  })
  groupId: string;

  @ApiProperty({
    description: 'Display name for the group',
    type: 'string',
    example: 'Fraud Investigation Team',
  })
  groupName: string;

  @ApiProperty({
    description: 'Type of group',
    type: 'string',
    default: 'candidate',
    example: 'candidate',
    required: false,
  })
  groupType?: string;
}

// Task DTO
export class TaskDto {
  @ApiProperty({
    description: 'Task ID',
    type: 'string',
    example: 'task-12345',
  })
  id: string;

  @ApiProperty({
    description: 'Task name',
    type: 'string',
    example: 'Review fraud case',
  })
  name: string;

  @ApiProperty({
    description: 'User assigned to the task',
    type: 'string',
    example: 'john.doe',
    required: false,
  })
  assignee?: string;

  @ApiProperty({
    description: 'Task creation date',
    type: 'string',
    format: 'date-time',
    example: '2024-12-04T10:30:00Z',
  })
  created: string;

  @ApiProperty({
    description: 'Task priority',
    type: 'number',
    example: 50,
  })
  priority: number;

  @ApiProperty({
    description: 'Task variables',
  })
  variables?: any;
}

// Work Queue Statistics DTO
export class WorkQueueGroupStatsDto {
  @ApiProperty({
    description: 'Group identifier',
    type: 'string',
    example: 'fraud-investigators',
  })
  groupId: string;

  @ApiProperty({
    description: 'Number of tasks in the group',
    type: 'number',
    example: 15,
  })
  taskCount: number;
}

export class WorkQueueStatisticsDto {
  @ApiProperty({
    description: 'Total number of tasks across all groups',
    type: 'number',
    example: 100,
  })
  totalTasks: number;

  @ApiProperty({
    description: 'Number of assigned tasks',
    type: 'number',
    example: 75,
  })
  assignedTasks: number;

  @ApiProperty({
    description: 'Number of unassigned tasks',
    type: 'number',
    example: 25,
  })
  unassignedTasks: number;

  @ApiProperty({
    description: 'Statistics for each group',
    type: [WorkQueueGroupStatsDto],
  })
  groups: WorkQueueGroupStatsDto[];
}
