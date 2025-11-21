import { TaskStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskDto {
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
      description: 'Updated investigation notes for the task',
      example: 'Updated investigation notes after further review.',
      required: false,
    })
    @IsString()
    @IsOptional()
    investigationNotes?: string;
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
    description: 'Updated task name',
    example: 'Verify customer identity documents - Updated',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Updated task description',
    example: 'Review and verify the submitted identity documents for compliance - Additional verification needed',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
