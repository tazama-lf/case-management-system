import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsArray, IsEnum, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, TaskType } from '@prisma/client-cms';
import { CreateAssignmentRuleDto } from './assignment-rule.dto';

export class CreateWorkQueueDto {
  @ApiProperty({
    description: 'Name of the work queue',
    example: 'Fraud Investigation Queue',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description of the work queue',
    example: 'Queue for handling high-priority fraud investigation tasks',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'User roles that can access this work queue',
    enum: UserRole,
    isArray: true,
    example: [UserRole.INVESTIGATOR, UserRole.SUPERVISOR],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];

  @ApiProperty({
    description: 'Task types that will be routed to this queue',
    enum: TaskType,
    isArray: true,
    example: [TaskType.INVESTIGATION, TaskType.EVIDENCE_COLLECTION],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TaskType, { each: true })
  taskTypes: TaskType[];

  @ApiProperty({
    description: 'Assignment rules for automatic task routing',
    type: [CreateAssignmentRuleDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  assignmentRules?: CreateAssignmentRuleDto[];
}
