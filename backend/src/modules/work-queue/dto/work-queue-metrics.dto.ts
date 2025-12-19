import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsEnum, IsDateString, IsBoolean, IsInt, Min } from 'class-validator';
import { TaskStatus, TaskType, Priority } from '@prisma/client-cms';

/**
 * DTO for task filtering in monitoring dashboard
 */
export class TaskFilterDto {
  @ApiPropertyOptional({
    description: 'Filter tasks by assigned user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks by priority',
    enum: Priority,
    example: Priority.URGENT,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Filter tasks by status',
    enum: TaskStatus,
    example: TaskStatus.STATUS_20_IN_PROGRESS,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Filter tasks by type',
    enum: TaskType,
    example: TaskType.INVESTIGATION,
  })
  @IsOptional()
  @IsEnum(TaskType)
  taskType?: TaskType;

  @ApiPropertyOptional({
    description: 'Filter tasks by SLA status (overdue, breach, on-track)',
    enum: ['overdue', 'breach', 'on-track', 'at-risk'],
    example: 'overdue',
  })
  @IsOptional()
  @IsString()
  slaStatus?: 'overdue' | 'breach' | 'on-track' | 'at-risk';

  @ApiPropertyOptional({
    description: 'Filter tasks created after this date (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks created before this date (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'Include only overdue tasks',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Include only tasks with SLA breaches',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  slaBreachOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * DTO for task count by status
 */
export class TaskCountByStatusDto {
  @ApiProperty({
    description: 'Task status',
    enum: TaskStatus,
    example: TaskStatus.STATUS_20_IN_PROGRESS,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Number of tasks with this status',
    example: 15,
  })
  count: number;
}

/**
 * DTO for SLA metrics
 */
export class SLAMetricsDto {
  @ApiProperty({
    description: 'Number of tasks that are overdue',
    example: 5,
  })
  overdueCount: number;

  @ApiProperty({
    description: 'Number of tasks with SLA breaches',
    example: 2,
  })
  breachCount: number;

  @ApiProperty({
    description: 'Number of tasks at risk of SLA breach (within 24 hours)',
    example: 8,
  })
  atRiskCount: number;

  @ApiProperty({
    description: 'Number of tasks on track',
    example: 35,
  })
  onTrackCount: number;

  @ApiProperty({
    description: 'Average time to completion in hours',
    example: 48.5,
  })
  avgCompletionTime: number;

  @ApiProperty({
    description: 'SLA compliance rate (percentage)',
    example: 92.5,
  })
  complianceRate: number;
}

/**
 * DTO for work queue metrics
 */
export class WorkQueueMetricsDto {
  @ApiProperty({
    description: 'Work queue ID',
    example: 1,
  })
  workQueueId: number;

  @ApiProperty({
    description: 'Work queue name',
    example: 'Fraud Investigation Queue',
  })
  workQueueName: string;

  @ApiProperty({
    description: 'Total number of tasks in the work queue',
    example: 50,
  })
  totalTasks: number;

  @ApiProperty({
    description: 'Number of active tasks (not completed)',
    example: 35,
  })
  activeTasks: number;

  @ApiProperty({
    description: 'Task counts grouped by status',
    type: [TaskCountByStatusDto],
  })
  taskCountsByStatus: TaskCountByStatusDto[];

  @ApiProperty({
    description: 'SLA metrics for the work queue',
    type: SLAMetricsDto,
  })
  slaMetrics: SLAMetricsDto;

  @ApiProperty({
    description: 'Number of assigned users in the work queue',
    example: 8,
  })
  assignedUserCount: number;

  @ApiProperty({
    description: 'Timestamp when metrics were calculated',
    example: '2025-10-17T12:30:00Z',
  })
  calculatedAt: Date;
}

/**
 * DTO for lightweight task summary in list views
 */
export class TaskSummaryDto {
  @ApiProperty({
    description: 'Task ID',
    example: 1,
  })
  taskId: number;

  @ApiProperty({
    description: 'Case ID associated with the task',
    example: 1,
  })
  caseId: number;

  @ApiProperty({
    description: 'Task name',
    example: 'Investigate suspicious transaction',
  })
  name: string;

  @ApiProperty({
    description: 'Task description',
    example: 'Review transaction patterns for potential fraud',
  })
  description: string;

  @ApiProperty({
    description: 'Task status',
    enum: TaskStatus,
    example: TaskStatus.STATUS_20_IN_PROGRESS,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Task type',
    enum: TaskType,
    example: TaskType.INVESTIGATION,
    nullable: true,
  })
  taskType: TaskType | null;

  @ApiProperty({
    description: 'Case priority',
    enum: Priority,
    example: Priority.URGENT,
  })
  priority: Priority;

  @ApiProperty({
    description: 'Assigned user ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
  })
  assignedUserId: string | null;

  @ApiProperty({
    description: 'Work queue ID',
    example: 1,
    nullable: true,
  })
  workQueueId: number | null;

  @ApiProperty({
    description: 'Task creation timestamp',
    example: '2025-10-15T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Task last update timestamp',
    example: '2025-10-17T14:30:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Is task overdue',
    example: false,
  })
  isOverdue: boolean;

  @ApiProperty({
    description: 'Has SLA breach',
    example: false,
  })
  hasSLABreach: boolean;

  @ApiProperty({
    description: 'Time until SLA deadline in hours (null if no SLA)',
    example: 12.5,
    nullable: true,
  })
  hoursUntilSLA: number | null;

  @ApiProperty({
    description: 'SLA status indicator',
    enum: ['overdue', 'breach', 'on-track', 'at-risk', 'none'],
    example: 'on-track',
  })
  slaStatus: 'overdue' | 'breach' | 'on-track' | 'at-risk' | 'none';
}

/**
 * DTO for paginated task list response
 */
export class TaskListResponseDto {
  @ApiProperty({
    description: 'List of tasks',
    type: [TaskSummaryDto],
  })
  tasks: TaskSummaryDto[];

  @ApiProperty({
    description: 'Total number of tasks matching the filter',
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

  @ApiProperty({
    description: 'Indicates if there are more pages',
    example: true,
  })
  hasMore: boolean;
}

/**
 * DTO for supervisor dashboard aggregated metrics
 */
export class SupervisorDashboardDto {
  @ApiProperty({
    description: 'Supervisor user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  supervisorId: string;

  @ApiProperty({
    description: 'Total number of work queues assigned to the supervisor',
    example: 3,
  })
  totalWorkQueues: number;

  @ApiProperty({
    description: 'Total number of tasks across all work queues',
    example: 150,
  })
  totalTasks: number;

  @ApiProperty({
    description: 'Total number of active tasks',
    example: 105,
  })
  totalActiveTasks: number;

  @ApiProperty({
    description: 'Aggregated task counts by status across all queues',
    type: [TaskCountByStatusDto],
  })
  aggregatedTaskCounts: TaskCountByStatusDto[];

  @ApiProperty({
    description: 'Aggregated SLA metrics across all queues',
    type: SLAMetricsDto,
  })
  aggregatedSLAMetrics: SLAMetricsDto;

  @ApiProperty({
    description: 'Metrics for each work queue',
    type: [WorkQueueMetricsDto],
  })
  workQueueMetrics: WorkQueueMetricsDto[];

  @ApiProperty({
    description: 'Total number of users assigned to all work queues',
    example: 25,
  })
  totalAssignedUsers: number;

  @ApiProperty({
    description: 'Timestamp when dashboard was generated',
    example: '2025-10-17T12:30:00Z',
  })
  generatedAt: Date;

  @ApiProperty({
    description: 'Recommended refresh interval in seconds',
    example: 60,
  })
  refreshInterval: number;
}

/**
 * DTO for overdue task details
 */
export class OverdueTaskDto extends TaskSummaryDto {
  @ApiProperty({
    description: 'Number of hours overdue',
    example: 24.5,
  })
  hoursOverdue: number;

  @ApiProperty({
    description: 'Expected completion date',
    example: '2025-10-16T10:00:00Z',
  })
  expectedCompletionDate: Date;
}

/**
 * DTO for SLA breach task details
 */
export class SLABreachTaskDto extends TaskSummaryDto {
  @ApiProperty({
    description: 'SLA deadline that was breached',
    example: '2025-10-16T10:00:00Z',
  })
  slaDeadline: Date;

  @ApiProperty({
    description: 'Number of hours past SLA deadline',
    example: 12.5,
  })
  hoursPastSLA: number;

  @ApiProperty({
    description: 'Severity of the breach (based on hours past deadline)',
    enum: ['minor', 'moderate', 'severe', 'critical'],
    example: 'moderate',
  })
  breachSeverity: 'minor' | 'moderate' | 'severe' | 'critical';
}
