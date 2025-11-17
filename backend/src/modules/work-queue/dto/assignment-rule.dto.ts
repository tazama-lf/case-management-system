import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsUUID,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Enum for rule trigger types
 */
export enum RuleTrigger {
  TASK_CREATED = 'TASK_CREATED',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
}

/**
 * Enum for rule condition attributes
 */
export enum RuleAttribute {
  TASK_TYPE = 'TASK_TYPE',
  TASK_STATUS = 'TASK_STATUS',
  CASE_PRIORITY = 'CASE_PRIORITY',
  CASE_TYPE = 'CASE_TYPE',
  CASE_STATUS = 'CASE_STATUS',
  ALERT_TYPE = 'ALERT_TYPE',
  SLA_DURATION = 'SLA_DURATION',
  CONFIDENCE_PERCENTAGE = 'CONFIDENCE_PERCENTAGE',
  PREDICTION_OUTCOME = 'PREDICTION_OUTCOME',
  TENANT_ID = 'TENANT_ID',
  ASSIGNED_USER_ID = 'ASSIGNED_USER_ID',
  WORK_QUEUE_ID = 'WORK_QUEUE_ID',
  CANDIDATE_GROUP = 'CANDIDATE_GROUP',
  CREATED_AT = 'CREATED_AT',
  CASE_OWNER_USER_ID = 'CASE_OWNER_USER_ID',
  CASE_CREATOR_USER_ID = 'CASE_CREATOR_USER_ID',
  CUSTOM = 'CUSTOM',
}

/**
 * Enum for rule operators
 */
export enum RuleOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  IS_NULL = 'IS_NULL',
  IS_NOT_NULL = 'IS_NOT_NULL',
}

/**
 * Enum for logical operators between conditions
 */
export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
}

/**
 * DTO for a single rule condition
 */
export class RuleConditionDto {
  @ApiProperty({
    description: 'Attribute to evaluate',
    enum: RuleAttribute,
    example: RuleAttribute.TASK_TYPE,
  })
  @IsEnum(RuleAttribute)
  attribute: RuleAttribute;

  @ApiProperty({
    description: 'Comparison operator',
    enum: RuleOperator,
    example: RuleOperator.EQUALS,
  })
  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ApiPropertyOptional({
    description: 'Value to compare against (can be string, number, array)',
    example: 'INVESTIGATION',
  })
  @IsOptional()
  value?: any;

  @ApiPropertyOptional({
    description: 'Logical operator to combine with next condition',
    enum: LogicalOperator,
    example: LogicalOperator.AND,
    default: LogicalOperator.AND,
  })
  @IsOptional()
  @IsEnum(LogicalOperator)
  logicalOperator?: LogicalOperator;
}

/**
 * DTO for rule action
 */
export class RuleActionDto {
  @ApiProperty({
    description: 'Target work queue ID to assign task to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  targetWorkQueueId: string;

  @ApiPropertyOptional({
    description: 'Optional user ID to assign task to within the queue',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  assignToUserId?: string;

  @ApiPropertyOptional({
    description: 'Set SLA deadline for the task (in hours from creation)',
    example: 48,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaDurationHours?: number;
}

/**
 * DTO for creating an assignment rule
 */
export class CreateAssignmentRuleDto {
  @ApiProperty({
    description: 'Rule name',
    example: 'High Priority Fraud Investigations',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @ApiPropertyOptional({
    description: 'Rule description',
    example: 'Automatically route high-priority fraud investigation tasks to the specialized fraud team',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Event that triggers rule evaluation',
    enum: RuleTrigger,
    example: RuleTrigger.TASK_CREATED,
  })
  @IsEnum(RuleTrigger)
  triggerType: RuleTrigger;

  @ApiProperty({
    description: 'Array of conditions that must be met for rule to apply',
    type: [RuleConditionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @ApiProperty({
    description: 'Action to take when rule matches',
    type: RuleActionDto,
  })
  @ValidateNested()
  @Type(() => RuleActionDto)
  action: RuleActionDto;

  @ApiProperty({
    description: 'Rule priority (higher number = higher priority, evaluated first)',
    example: 10,
    minimum: 0,
    maximum: 100,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  priorityOrder: number;

  @ApiPropertyOptional({
    description: 'Whether rule is active',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Stop evaluating other rules if this rule matches',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  stopOnMatch?: boolean;
}

/**
 * DTO for updating an assignment rule
 */
export class UpdateAssignmentRuleDto {
  @ApiPropertyOptional({
    description: 'Rule name',
    example: 'High Priority Fraud Investigations',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ruleName?: string;

  @ApiPropertyOptional({
    description: 'Rule description',
    example: 'Automatically route high-priority fraud investigation tasks to the specialized fraud team',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Event that triggers rule evaluation',
    enum: RuleTrigger,
    example: RuleTrigger.TASK_CREATED,
  })
  @IsOptional()
  @IsEnum(RuleTrigger)
  triggerType?: RuleTrigger;

  @ApiPropertyOptional({
    description: 'Array of conditions that must be met for rule to apply',
    type: [RuleConditionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions?: RuleConditionDto[];

  @ApiPropertyOptional({
    description: 'Action to take when rule matches',
    type: RuleActionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleActionDto)
  action?: RuleActionDto;

  @ApiPropertyOptional({
    description: 'Rule priority (higher number = higher priority, evaluated first)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priorityOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether rule is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Stop evaluating other rules if this rule matches',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  stopOnMatch?: boolean;
}

/**
 * DTO for rule test/dry-run request
 */
export class TestRuleDto {
  @ApiProperty({
    description: 'Test context data (task and case attributes)',
    example: {
      taskType: 'INVESTIGATION',
      casePriority: 'URGENT',
      caseType: 'FRAUD',
    },
  })
  @IsObject()
  testContext: Record<string, any>;
}

/**
 * DTO for rule test result
 */
export class RuleTestResultDto {
  @ApiProperty({
    description: 'Whether the rule would match',
    example: true,
  })
  matches: boolean;

  @ApiProperty({
    description: 'Target work queue ID if rule matches',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  targetWorkQueueId: string | null;

  @ApiProperty({
    description: 'Target work queue name if rule matches',
    example: 'High Priority Investigation Queue',
    nullable: true,
  })
  targetWorkQueueName: string | null;

  @ApiProperty({
    description: 'Evaluation details for each condition',
    type: 'array',
  })
  conditionResults: Array<{
    condition: RuleConditionDto;
    matched: boolean;
    actualValue: any;
    expectedValue: any;
  }>;

  @ApiPropertyOptional({
    description: 'Error message if validation fails',
  })
  error?: string;
}

/**
 * DTO for detailed Assignment Rule response (conditional logic rules)
 */
export class DetailedAssignmentRuleDto {
  @ApiProperty({
    description: 'Unique identifier of the assignment rule',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  ruleId: string;

  @ApiProperty({
    description: 'Work queue this rule belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  workQueueId: string;

  @ApiProperty({
    description: 'Name of the rule',
    example: 'High Priority Investigation Assignment',
  })
  ruleName: string;

  @ApiProperty({
    description: 'When the rule should be triggered',
    enum: RuleTrigger,
    example: RuleTrigger.TASK_CREATED,
  })
  triggerType: RuleTrigger;

  @ApiProperty({
    description: 'Rule conditions',
    type: [RuleConditionDto],
  })
  conditions: RuleConditionDto[];

  @ApiProperty({
    description: 'Rule action',
    type: RuleActionDto,
  })
  action: RuleActionDto;

  @ApiProperty({
    description: 'Rule priority order (0-100)',
    example: 10,
  })
  priorityOrder: number;

  @ApiProperty({
    description: 'Stop evaluating other rules if this one matches',
    example: true,
  })
  stopOnMatch: boolean;

  @ApiProperty({
    description: 'Whether the rule is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Number of times this rule has been applied',
    example: 150,
  })
  applicationCount: number;

  @ApiProperty({
    description: 'Last time the rule was applied',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  lastAppliedAt?: Date;

  @ApiProperty({
    description: 'When the rule was created',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the rule was last updated',
    example: '2024-01-15T12:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'ID of user who created the rule',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  createdBy: string;

  @ApiProperty({
    description: 'ID of user who last updated the rule',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  updatedBy?: string;
}

/**
 * DTO for rule validation result
 */
export class RuleValidationResultDto {
  @ApiProperty({
    description: 'Whether rule is valid',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'Validation errors',
    type: [String],
    example: [],
  })
  errors: string[];

  @ApiProperty({
    description: 'Validation warnings',
    type: [String],
    example: ['Rule has low priority and may not be evaluated first'],
  })
  warnings: string[];

  @ApiProperty({
    description: 'Conflicting rules',
    type: [Object],
  })
  conflicts: Array<{
    ruleId: string;
    ruleName: string;
    conflictReason: string;
  }>;
}

/**
 * DTO for bulk rule application result
 */
export class RuleApplicationResultDto {
  @ApiProperty({
    description: 'Task ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskId: string;

  @ApiProperty({
    description: 'Whether a rule was applied',
    example: true,
  })
  ruleApplied: boolean;

  @ApiPropertyOptional({
    description: 'Applied rule ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  appliedRuleId?: string;

  @ApiPropertyOptional({
    description: 'Applied rule name',
    example: 'High Priority Fraud Investigations',
  })
  appliedRuleName?: string;

  @ApiPropertyOptional({
    description: 'Assigned work queue ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  assignedWorkQueueId?: string;

  @ApiPropertyOptional({
    description: 'Assigned work queue name',
    example: 'Fraud Investigation Queue',
  })
  assignedWorkQueueName?: string;

  @ApiProperty({
    description: 'Application timestamp',
    example: '2025-10-17T14:30:00Z',
  })
  appliedAt: Date;

  @ApiPropertyOptional({
    description: 'Error message if application failed',
  })
  error?: string;
}
