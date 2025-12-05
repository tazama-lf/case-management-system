import { Injectable, Logger } from '@nestjs/common';
import { Task, WorkQueueAssignmentRule, Case } from '@prisma/client';
import {
  RuleAttribute,
  RuleOperator,
  LogicalOperator,
  RuleTrigger,
  RuleConditionDto,
  RuleActionDto,
  CreateAssignmentRuleDto,
  RuleValidationResultDto,
} from './dto/assignment-rule.dto';

/**
 * Service for evaluating and applying assignment rules with conditional logic
 *
 * DEPRECATED
 * This service implements automated task assignment rules based on conditions.
 * This functionality is NOT part of the MVP and has been disabled.
 * No frontend exists for managing these rules.
 *
 * The code is kept for future implementation but should not be actively used.
 * To re-enable: Uncomment controller endpoints in work-queue.controller.ts
 * and task auto-assignment logic in task.service.ts
 */
@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  /**
   * Evaluate a rule against task and case data
   */
  evaluateRule(rule: WorkQueueAssignmentRule, task: Task & { case?: Case }, context: Record<string, any> = {}): boolean {
    try {
      if (!rule.is_active) {
        return false;
      }

      const conditions: RuleConditionDto[] = (rule.conditions as unknown as RuleConditionDto[]) || [];

      if (conditions.length === 0) {
        return true;
      }

      return this.evaluateConditions(conditions, task, context);
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.assignment_rule_id}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Evaluate multiple conditions with logical operators
   */
  private evaluateConditions(conditions: RuleConditionDto[], task: Task & { case?: Case }, context: Record<string, any>): boolean {
    if (conditions.length === 0) return true;

    let result = this.evaluateCondition(conditions[0], task, context);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, task, context);

      if (condition.logicalOperator === LogicalOperator.OR) {
        result = result || conditionResult;
      } else {
        result = result && conditionResult;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: RuleConditionDto, task: Task & { case?: Case }, context: Record<string, any>): boolean {
    const actualValue = this.getAttributeValue(condition.attribute, task, context);
    return this.matchesOperator(actualValue, condition.operator, condition.value);
  }

  /**
   * Get the actual value of an attribute from task/case data
   */
  private getAttributeValue(attribute: RuleAttribute, task: Task & { case?: Case }, context: Record<string, any>): any {
    switch (attribute) {
      case RuleAttribute.TASK_TYPE:
        return task.task_type;
      case RuleAttribute.TASK_STATUS:
        return task.status;
      case RuleAttribute.CASE_PRIORITY:
        return task.case?.priority;
      case RuleAttribute.CASE_STATUS:
        return task.case?.status;
      case RuleAttribute.CASE_TYPE:
        return task.case?.case_type;
      case RuleAttribute.ASSIGNED_USER_ID:
        return task.assigned_user_id;
      case RuleAttribute.WORK_QUEUE_ID:
        return task.work_queue_id;
      case RuleAttribute.CANDIDATE_GROUP:
        return task.candidateGroup;
      case RuleAttribute.TENANT_ID:
        return task.case?.tenant_id;
      case RuleAttribute.CREATED_AT:
        return task.created_at;
      case RuleAttribute.CASE_OWNER_USER_ID:
        return task.case?.case_owner_user_id;
      case RuleAttribute.CASE_CREATOR_USER_ID:
        return task.case?.case_creator_user_id;
      case RuleAttribute.CUSTOM:
        return context;
      default:
        return null;
    }
  }

  /**
   * Check if actual value matches the operator and expected value
   */
  private matchesOperator(actualValue: any, operator: RuleOperator, expectedValue: any): boolean {
    if (actualValue === null || actualValue === undefined) {
      return operator === RuleOperator.IS_NULL;
    }

    switch (operator) {
      case RuleOperator.EQUALS:
        return actualValue === expectedValue;

      case RuleOperator.NOT_EQUALS:
        return actualValue !== expectedValue;

      case RuleOperator.IN:
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);

      case RuleOperator.NOT_IN:
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);

      case RuleOperator.CONTAINS:
        return typeof actualValue === 'string' && actualValue.includes(expectedValue);

      case RuleOperator.NOT_CONTAINS:
        return typeof actualValue === 'string' && !actualValue.includes(expectedValue);

      case RuleOperator.STARTS_WITH:
        return typeof actualValue === 'string' && actualValue.startsWith(expectedValue);

      case RuleOperator.ENDS_WITH:
        return typeof actualValue === 'string' && actualValue.endsWith(expectedValue);

      case RuleOperator.GREATER_THAN:
        return actualValue > expectedValue;

      case RuleOperator.GREATER_THAN_OR_EQUAL:
        return actualValue >= expectedValue;

      case RuleOperator.LESS_THAN:
        return actualValue < expectedValue;

      case RuleOperator.LESS_THAN_OR_EQUAL:
        return actualValue <= expectedValue;

      case RuleOperator.IS_NULL:
        return actualValue === null || actualValue === undefined;

      case RuleOperator.IS_NOT_NULL:
        return actualValue !== null && actualValue !== undefined;

      default:
        this.logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Find all matching rules for a task (ordered by priority)
   */
  findMatchingRules(
    rules: WorkQueueAssignmentRule[],
    task: Task & { case?: Case },
    context: Record<string, any> = {},
  ): WorkQueueAssignmentRule[] {
    const sortedRules = [...rules].sort((a, b) => b.priority_order - a.priority_order);

    const matchingRules: WorkQueueAssignmentRule[] = [];

    for (const rule of sortedRules) {
      if (this.evaluateRule(rule, task, context)) {
        matchingRules.push(rule);

        if (rule.stop_on_match) {
          break;
        }
      }
    }

    return matchingRules;
  }

  /**
   * Apply a rule's action to a task
   */
  applyRule(
    rule: WorkQueueAssignmentRule,
    task: Task,
  ): {
    success: boolean;
    ruleId: string;
    ruleName?: string;
    workQueueId?: string;
    assignedUserId?: string;
    slaDurationHours?: number;
    updates?: Partial<Task>;
    message: string;
  } {
    try {
      const action: RuleActionDto = rule.actions as unknown as RuleActionDto;

      if (!action) {
        return {
          success: false,
          ruleId: rule.assignment_rule_id,
          message: 'No action defined for rule',
        };
      }

      const updates: Partial<Task> = {};

      if (action.targetWorkQueueId) {
        updates.work_queue_id = action.targetWorkQueueId;
      }

      if (action.assignToUserId) {
        updates.assigned_user_id = action.assignToUserId;
      }

      if (action.slaDurationHours) {
        updates.sla_duration_hours = action.slaDurationHours;
        updates.sla_deadline = new Date(Date.now() + action.slaDurationHours * 60 * 60 * 1000);
      }

      return {
        success: true,
        ruleId: rule.assignment_rule_id,
        ruleName: rule.rule_name,
        workQueueId: action.targetWorkQueueId,
        assignedUserId: action.assignToUserId,
        slaDurationHours: action.slaDurationHours,
        updates,
        message: 'Rule applied successfully',
      };
    } catch (error) {
      this.logger.error(`Error applying rule ${rule.assignment_rule_id}: ${error.message}`, error.stack);

      return {
        success: false,
        ruleId: rule.assignment_rule_id,
        message: `Failed to apply rule: ${error.message}`,
      };
    }
  }

  /**
   * Validate a rule configuration
   */
  validateRule(dto: CreateAssignmentRuleDto): RuleValidationResultDto {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!dto.ruleName || dto.ruleName.trim().length === 0) {
      errors.push('Rule name is required');
    }

    if (!Object.values(RuleTrigger).includes(dto.triggerType)) {
      errors.push(`Invalid trigger type: ${dto.triggerType}`);
    }

    if (!dto.conditions || dto.conditions.length === 0) {
      warnings.push('Rule has no conditions and will match all tasks');
    } else {
      dto.conditions.forEach((condition, index) => {
        if (!Object.values(RuleAttribute).includes(condition.attribute)) {
          errors.push(`Invalid attribute in condition ${index}: ${condition.attribute}`);
        }
        if (!Object.values(RuleOperator).includes(condition.operator)) {
          errors.push(`Invalid operator in condition ${index}: ${condition.operator}`);
        }
        if (condition.value === null || condition.value === undefined) {
          if (condition.operator !== RuleOperator.IS_NULL && condition.operator !== RuleOperator.IS_NOT_NULL) {
            errors.push(`Condition ${index} requires a value for operator ${condition.operator}`);
          }
        }
        if (condition.logicalOperator && !Object.values(LogicalOperator).includes(condition.logicalOperator)) {
          errors.push(`Invalid logical operator in condition ${index}: ${condition.logicalOperator}`);
        }
      });
    }

    if (!dto.action) {
      errors.push('Rule action is required');
    } else {
      if (!dto.action.targetWorkQueueId) {
        warnings.push('No target work queue specified in action');
      }
      if (dto.action.slaDurationHours && dto.action.slaDurationHours < 0) {
        errors.push('SLA duration must be non-negative');
      }
    }

    if (dto.priorityOrder < 0 || dto.priorityOrder > 100) {
      errors.push('Priority order must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflicts: [],
    };
  }

  /**
   * Check for conflicts between rules
   */
  checkRuleConflicts(newRule: CreateAssignmentRuleDto, existingRules: WorkQueueAssignmentRule[]): string[] {
    const conflicts: string[] = [];

    const duplicateName = existingRules.find((rule) => rule.rule_name === newRule.ruleName && rule.is_active);
    if (duplicateName) {
      conflicts.push(`Another active rule with name "${newRule.ruleName}" already exists`);
    }

    for (const existingRule of existingRules) {
      if (!existingRule.is_active) continue;

      const existingConditions = existingRule.conditions as unknown as RuleConditionDto[];
      if (
        existingConditions &&
        JSON.stringify(existingConditions) === JSON.stringify(newRule.conditions) &&
        existingRule.trigger_type === newRule.triggerType
      ) {
        conflicts.push(`Rule "${existingRule.rule_name}" has identical conditions and trigger`);
      }
    }

    const samePriority = existingRules.filter(
      (rule) => rule.priority_order === newRule.priorityOrder && rule.is_active && rule.stop_on_match !== newRule.stopOnMatch,
    );
    if (samePriority.length > 0) {
      conflicts.push(`Rules with same priority but different stop_on_match behavior: ${samePriority.map((r) => r.rule_name).join(', ')}`);
    }

    return conflicts;
  }

  /**
   * Test a rule against sample data (dry run)
   */
  testRule(
    ruleDto: CreateAssignmentRuleDto,
    testContext: Record<string, any>,
    existingRules: WorkQueueAssignmentRule[],
  ): {
    wouldMatch: boolean;
    validation: RuleValidationResultDto;
    simulatedResult?: any;
    message: string;
  } {
    const validation = this.validateRule(ruleDto);
    if (!validation.isValid) {
      return {
        wouldMatch: false,
        validation,
        message: 'Rule validation failed',
      };
    }

    const conflicts = this.checkRuleConflicts(ruleDto, existingRules);

    return {
      wouldMatch: false,
      validation: {
        ...validation,
        conflicts: conflicts.map((c) => ({
          ruleId: '',
          ruleName: '',
          conflictReason: c,
        })),
      },
      message: 'Rule test completed',
    };
  }
}
