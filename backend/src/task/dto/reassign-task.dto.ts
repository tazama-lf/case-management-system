import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for reassigning a task to a different work queue
 */
export class ReassignTaskDto {
  @ApiProperty({
    description: 'Target work queue ID to reassign the task to',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsUUID('4', { message: 'Target work queue ID must be a valid UUID' })
  targetWorkQueueId: string;

  @ApiProperty({
    description: 'Optional reason for reassigning the task (captured in audit log)',
    example: 'Task requires specialized fraud analysis expertise',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason?: string;

  @ApiProperty({
    description: 'Optional user ID to immediately assign the task to in the target queue',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Assigned user ID must be a valid UUID' })
  assignedUserId?: string;
}

/**
 * Response DTO for task reassignment operation
 */
export class TaskReassignmentResponseDto {
  @ApiProperty({
    description: 'Task ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskId: string;

  @ApiProperty({
    description: 'Previous work queue ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  oldWorkQueueId: string;

  @ApiProperty({
    description: 'Previous work queue name',
    example: 'General Investigation Queue',
  })
  oldWorkQueueName: string;

  @ApiProperty({
    description: 'New work queue ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  newWorkQueueId: string;

  @ApiProperty({
    description: 'New work queue name',
    example: 'Fraud Specialist Queue',
  })
  newWorkQueueName: string;

  @ApiProperty({
    description: 'Current task status after reassignment',
    example: 'STATUS_10_ASSIGNED',
  })
  status: string;

  @ApiProperty({
    description: 'User ID the task is assigned to (if any)',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  assignedUserId?: string;

  @ApiProperty({
    description: 'Reason for reassignment',
    example: 'Task requires specialized fraud analysis expertise',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Timestamp of reassignment',
    example: '2025-10-17T12:00:00Z',
  })
  reassignedAt: Date;

  @ApiProperty({
    description: 'User ID who performed the reassignment',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  reassignedBy: string;
}
