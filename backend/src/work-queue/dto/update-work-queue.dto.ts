import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, TaskType } from '@prisma/client-cms';
import { CreateAssignmentRuleDto } from './assignment-rule.dto';

export class UpdateWorkQueueDto {
  @ApiProperty({
    description: 'Name of the work queue',
    example: 'Fraud Investigation Queue',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Description of the work queue',
    example: 'Queue for handling high-priority fraud investigation tasks',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'User roles that can access this work queue',
    enum: UserRole,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiProperty({
    description: 'Task types that will be routed to this queue',
    enum: TaskType,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskType, { each: true })
  taskTypes?: TaskType[];

  @ApiProperty({
    description: 'Whether the work queue is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Assignment rules for automatic task routing',
    type: [CreateAssignmentRuleDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  assignmentRules?: CreateAssignmentRuleDto[];
}
