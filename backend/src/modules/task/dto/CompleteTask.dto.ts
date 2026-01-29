import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus } from '@prisma/client-cms';

export class CompleteTaskDTO {
  @ApiProperty({
    description: 'Updated status of the task',
    enum: TaskStatus,
    example: TaskStatus.STATUS_20_IN_PROGRESS,
    required: false,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({
    description: 'UUID of the user to assign the task to (null to unassign)',
    example: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  assignedUserId?: string | undefined;

  @ApiProperty({
    description: 'Completion variables for flowable task',
    format: 'object',
    required: false,
  })
  @IsOptional()
  completionVariables?: Record<string, unknown>;
}
