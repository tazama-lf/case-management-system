import { ApiProperty } from '@nestjs/swagger';
import { UserRole, TaskType, AssignmentRuleType } from '@prisma/client-cms';

export class AssignmentRuleResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  assignmentRuleId: string;

  @ApiProperty({ enum: AssignmentRuleType })
  ruleType: AssignmentRuleType;

  @ApiProperty({ example: { priorities: ['URGENT', 'CRITICAL'] } })
  ruleConfig: Record<string, any>;

  @ApiProperty({ example: 1 })
  priorityOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updatedAt: Date;
}

export class WorkQueueResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  workQueueId: string;

  @ApiProperty({ example: 'Fraud Investigation Queue' })
  name: string;

  @ApiProperty({ example: 'Queue for handling fraud investigation tasks', required: false })
  description?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  tenantId: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  createdByUserId: string;

  @ApiProperty({ enum: UserRole, isArray: true })
  roles: UserRole[];

  @ApiProperty({ enum: TaskType, isArray: true })
  taskTypes: TaskType[];

  @ApiProperty({ example: 0 })
  taskCount: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updatedAt: Date;
}

export class WorkQueueDetailResponseDto extends WorkQueueResponseDto {
  @ApiProperty({ type: [AssignmentRuleResponseDto] })
  assignmentRules: AssignmentRuleResponseDto[];

  @ApiProperty({ example: 5 })
  pendingTaskCount: number;

  @ApiProperty({ example: 3 })
  inProgressTaskCount: number;

  @ApiProperty({ example: 10 })
  completedTaskCount: number;
}

export class WorkQueueListResponseDto {
  @ApiProperty({ type: [WorkQueueResponseDto] })
  data: WorkQueueResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
