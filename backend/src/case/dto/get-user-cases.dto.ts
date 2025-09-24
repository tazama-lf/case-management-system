import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CaseStatus, Priority } from '@prisma/client';

export class GetUserCasesQueryDto {
  @ApiProperty({
    description: 'Filter by case status',
    enum: CaseStatus,
    required: false,
    example: 'STATUS_20_IN_PROGRESS',
  })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiProperty({
    description: 'Filter by priority',
    enum: Priority,
    required: false,
    example: 'URGENT',
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({
    description: 'Include cases where user has tasks assigned',
    required: false,
    default: true,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeTaskAssignments?: boolean = true;

  @ApiProperty({
    description: 'Include only cases owned by the user',
    required: false,
    default: true,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeOwnedCases?: boolean = true;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Sort field',
    required: false,
    default: 'created_at',
    enum: ['created_at', 'updated_at', 'priority', 'status'],
    example: 'created_at',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiProperty({
    description: 'Sort order',
    required: false,
    default: 'desc',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class UserTaskDto {
  @ApiProperty({
    description: 'Task ID',
    example: 'task-123e4567-e89b-12d3-a456-426614174000',
  })
  task_id: string;

  @ApiProperty({
    description: 'Task name',
    example: 'Investigate Case',
  })
  name: string;

  @ApiProperty({
    description: 'Task status',
    example: 'STATUS_20_IN_PROGRESS',
  })
  status: string;

  @ApiProperty({
    description: 'Task creation timestamp',
    example: '2024-01-15T10:00:00Z',
  })
  created_at: Date;
}

export class AlertInfoDto {
  @ApiProperty({
    description: 'Alert ID',
    example: 'alert-123e4567-e89b-12d3-a456-426614174000',
  })
  alert_id: string;

  @ApiProperty({
    description: 'Alert message',
    example: 'Suspicious transaction detected',
  })
  message: string;

  @ApiProperty({
    description: 'Confidence percentage',
    example: 85,
  })
  confidence_per: number;
}

export class CaseWithTasksDto {
  @ApiProperty({
    description: 'Case ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  case_id: string;

  @ApiProperty({
    description: 'Case status',
    enum: CaseStatus,
    example: 'STATUS_20_IN_PROGRESS',
  })
  status: CaseStatus;

  @ApiProperty({
    description: 'Case priority',
    enum: Priority,
    example: 'URGENT',
  })
  priority: Priority;

  @ApiProperty({
    description: 'Case type',
    example: 'FRAUD',
  })
  case_type: string;

  @ApiProperty({
    description: 'Case creation timestamp',
    example: '2024-01-15T10:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Case update timestamp',
    example: '2024-01-15T12:00:00Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'User relationship to case',
    example: 'owner',
    enum: ['owner', 'task_assignee', 'both'],
  })
  user_role: 'owner' | 'task_assignee' | 'both';

  @ApiProperty({
    description: 'Tasks assigned to the user in this case',
    type: [UserTaskDto],
  })
  user_tasks: UserTaskDto[];

  @ApiProperty({
    description: 'Total number of tasks in the case',
    example: 5,
  })
  total_tasks: number;

  @ApiProperty({
    description: 'Alert information if available',
    type: AlertInfoDto,
    required: false,
  })
  alert?: AlertInfoDto;
}

// Create separate classes for nested objects to fix the type issues
export class PaginationDto {
  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

export class SummaryStatisticsDto {
  @ApiProperty({
    description: 'Total number of cases owned by user',
    example: 10,
  })
  totalOwnedCases: number;

  @ApiProperty({
    description: 'Total number of task assignments',
    example: 15,
  })
  totalTaskAssignments: number;

  @ApiProperty({
    description: 'Case counts by status',
    example: {
      STATUS_20_IN_PROGRESS: 5,
      STATUS_10_ASSIGNED: 3,
    },
    additionalProperties: {
      type: 'number',
    },
  })
  casesByStatus: Record<string, number>;

  @ApiProperty({
    description: 'Case counts by priority',
    example: {
      URGENT: 5,
      NEW: 3,
    },
    additionalProperties: {
      type: 'number',
    },
  })
  casesByPriority: Record<string, number>;
}

export class GetUserCasesResponseDto {
  @ApiProperty({
    description: 'List of cases',
    type: [CaseWithTasksDto],
  })
  cases: CaseWithTasksDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Summary statistics',
    type: SummaryStatisticsDto,
  })
  summary: SummaryStatisticsDto;
}
