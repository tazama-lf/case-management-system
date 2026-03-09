import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, IsEnum, IsOptional, ArrayMinSize } from 'class-validator';
import { AssignmentType } from '@prisma/client-cms';

/**
 * DTO for assigning users to a work queue
 */
export class AssignUsersDto {
  @ApiProperty({
    description: 'Array of user IDs to assign to the work queue',
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one user ID must be provided' })
  @IsUUID('4', { each: true, message: 'Each user ID must be a valid UUID' })
  userIds: string[];

  @ApiProperty({
    description: 'Assignment type: MANUAL (admin assignment), AUTOMATIC (role-based), or OVERRIDE (admin override of automatic)',
    enum: AssignmentType,
    example: AssignmentType.MANUAL,
    default: AssignmentType.MANUAL,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssignmentType, { message: 'Assignment type must be MANUAL, AUTOMATIC, or OVERRIDE' })
  assignmentType?: AssignmentType = AssignmentType.MANUAL;
}

/**
 * DTO for removing users from a work queue
 */
export class RemoveUsersDto {
  @ApiProperty({
    description: 'Array of user IDs to remove from the work queue',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one user ID must be provided' })
  @IsUUID('4', { each: true, message: 'Each user ID must be a valid UUID' })
  userIds: string[];
}

/**
 * Response DTO for user assignment operations
 */
export class UserAssignmentResponseDto {
  @ApiProperty({
    description: 'Work queue member ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  memberId: string;

  @ApiProperty({
    description: 'Work queue ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  workQueueId: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Assignment type',
    enum: AssignmentType,
    example: AssignmentType.MANUAL,
  })
  assignmentType: AssignmentType;

  @ApiProperty({
    description: 'ID of the user who made the assignment',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  assignedBy?: string;

  @ApiProperty({
    description: 'Timestamp when the user was assigned',
    example: '2025-10-17T10:30:00Z',
  })
  assignedAt: Date;
}

/**
 * Response DTO for listing work queue members
 */
export class WorkQueueMemberDto {
  @ApiProperty({
    description: 'Work queue member ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  memberId: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Assignment type',
    enum: AssignmentType,
    example: AssignmentType.MANUAL,
  })
  assignmentType: AssignmentType;

  @ApiProperty({
    description: 'ID of the user who made the assignment',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  assignedBy?: string;

  @ApiProperty({
    description: 'Timestamp when the user was assigned',
    example: '2025-10-17T10:30:00Z',
  })
  assignedAt: Date;

  @ApiProperty({
    description: 'Timestamp when the assignment was last updated',
    example: '2025-10-17T10:30:00Z',
  })
  updatedAt: Date;
}
