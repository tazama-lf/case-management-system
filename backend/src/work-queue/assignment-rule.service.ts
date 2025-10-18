import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentRuleType } from '@prisma/client';

interface RuleConfig {
  priorities?: string[];
  caseTypes?: string[];
  minPriority?: string;
  maxTasksPerUser?: number;
  [key: string]: any;
}

interface TaskForAssignment {
  task_id: string;
  task_type?: string;
  priority?: string;
  case_type?: string;
  tenant_id: string;
}

@Injectable()
export class AssignmentRuleService {
  private readonly logger = new Logger(AssignmentRuleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automatically assigns a task to the most appropriate work queue
   * based on active assignment rules
   */
  async autoAssignTask(taskId: string, tenantId: string): Promise<{ workQueueId: string; ruleName: string } | null> {
    this.logger.log(`Auto-assigning task ${taskId} for tenant ${tenantId}`);

    // Get task details
    const task = await this.prisma.task.findUnique({
      where: { task_id: taskId },
      select: {
        task_id: true,
        task_type: true,
        case: {
          select: {
            case_type: true,
            priority: true,
            tenant_id: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    if (task.case.tenant_id !== tenantId) {
      throw new NotFoundException(`Task ${taskId} not found in tenant ${tenantId}`);
    }

    // Get all active work queues with their assignment rules
    const workQueues = await this.prisma.workQueue.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        assignmentRules: {
          where: { is_active: true },
          orderBy: { priority_order: 'asc' },
        },
        taskTypes: true,
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (workQueues.length === 0) {
      this.logger.warn(`No active work queues found for tenant ${tenantId}`);
      return null;
    }

    // Evaluate rules for each queue
    const taskData: TaskForAssignment = {
      task_id: task.task_id,
      task_type: task.task_type || undefined,
      priority: task.case.priority,
      case_type: task.case.case_type || undefined,
      tenant_id: task.case.tenant_id,
    };

    for (const queue of workQueues) {
      const supportsTaskType = queue.taskTypes.some((tt) => tt.task_type === task.task_type);

      if (!supportsTaskType) {
        continue;
      }

      for (const rule of queue.assignmentRules) {
        const matches = await this.evaluateRule(rule.rule_type, rule.rule_config as RuleConfig, taskData, queue);

        if (matches) {
          await this.prisma.task.update({
            where: { task_id: taskId },
            data: { work_queue_id: queue.work_queue_id },
          });

          await this.logAuditEvent(
            'SYSTEM',
            'AUTO_ASSIGN',
            'Task',
            `Auto-assigned task ${taskId} to queue ${queue.name} using rule ${rule.rule_type}`,
            'SUCCESS',
          );

          this.logger.log(`Task ${taskId} assigned to queue ${queue.name} using rule ${rule.rule_type}`);

          return {
            workQueueId: queue.work_queue_id,
            ruleName: rule.rule_type,
          };
        }
      }
    }

    this.logger.warn(`No matching rules found for task ${taskId}`);
    return null;
  }

  /**
   * Evaluates a single assignment rule against a task
   */
  private async evaluateRule(ruleType: AssignmentRuleType, ruleConfig: RuleConfig, task: TaskForAssignment, queue: any): Promise<boolean> {
    switch (ruleType) {
      case AssignmentRuleType.PRIORITY_BASED:
        return this.evaluatePriorityRule(ruleConfig, task);

      case AssignmentRuleType.CASE_TYPE_BASED:
        return this.evaluateCaseTypeRule(ruleConfig, task);

      case AssignmentRuleType.ROUND_ROBIN:
        return this.evaluateRoundRobinRule(queue);

      case AssignmentRuleType.LOAD_BALANCED:
        return this.evaluateLoadBalancedRule(ruleConfig, queue);

      default:
        this.logger.warn(`Unknown rule type: ${ruleType}`);
        return false;
    }
  }

  /**
   * Evaluates priority-based assignment rule
   */
  private evaluatePriorityRule(config: RuleConfig, task: TaskForAssignment): boolean {
    if (!task.priority) {
      return false;
    }

    if (config.priorities && Array.isArray(config.priorities)) {
      return config.priorities.includes(task.priority);
    }

    if (config.minPriority) {
      const priorityOrder = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];
      const taskPriorityIndex = priorityOrder.indexOf(task.priority);
      const minPriorityIndex = priorityOrder.indexOf(config.minPriority);

      return taskPriorityIndex >= minPriorityIndex;
    }

    return false;
  }

  /**
   * Evaluates case-type-based assignment rule
   */
  private evaluateCaseTypeRule(config: RuleConfig, task: TaskForAssignment): boolean {
    if (!task.case_type || !config.caseTypes) {
      return false;
    }

    return config.caseTypes.includes(task.case_type);
  }

  /**
   * Evaluates round-robin assignment rule
   * Always returns true - distributes evenly across queues
   */
  private evaluateRoundRobinRule(_queue: any): boolean {
    return true;
  }

  /**
   * Evaluates load-balanced assignment rule
   */
  private async evaluateLoadBalancedRule(config: RuleConfig, queue: any): Promise<boolean> {
    const currentTaskCount = queue._count.tasks;

    if (config.maxTasksPerUser) {
      return currentTaskCount < config.maxTasksPerUser;
    }

    return true;
  }

  /**
   * Finds the best work queue for a task based on all available rules
   */
  async findBestQueue(taskId: string, tenantId: string): Promise<string | null> {
    const result = await this.autoAssignTask(taskId, tenantId);
    return result?.workQueueId || null;
  }

  /**
   * Re-evaluates and reassigns tasks if rules have changed
   */
  async rebalanceTasks(workQueueId: string, tenantId: string): Promise<number> {
    this.logger.log(`Rebalancing tasks for work queue ${workQueueId}`);

    const tasks = await this.prisma.task.findMany({
      where: {
        work_queue_id: workQueueId,
        case: {
          tenant_id: tenantId,
        },
        status: {
          in: ['STATUS_20_IN_PROGRESS', 'STATUS_01_UNASSIGNED'],
        },
      },
    });

    let reassignedCount = 0;

    for (const task of tasks) {
      try {
        const result = await this.autoAssignTask(task.task_id, tenantId);
        if (result && result.workQueueId !== workQueueId) {
          reassignedCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to reassign task ${task.task_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.log(`Reassigned ${reassignedCount} tasks from queue ${workQueueId}`);
    return reassignedCount;
  }

  /**
   * Gets statistics about rule effectiveness
   */
  async getRuleStatistics(
    workQueueId: string,
    tenantId: string,
  ): Promise<{
    totalRules: number;
    activeRules: number;
    tasksAssigned: number;
    avgTasksPerRule: number;
  }> {
    const queue = await this.prisma.workQueue.findUnique({
      where: {
        work_queue_id: workQueueId,
        tenant_id: tenantId,
      },
      include: {
        assignmentRules: true,
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!queue) {
      throw new NotFoundException(`Work queue ${workQueueId} not found`);
    }

    const totalRules = queue.assignmentRules.length;
    const activeRules = queue.assignmentRules.filter((r) => r.is_active).length;
    const tasksAssigned = queue._count.tasks;
    const avgTasksPerRule = activeRules > 0 ? tasksAssigned / activeRules : 0;

    return {
      totalRules,
      activeRules,
      tasksAssigned,
      avgTasksPerRule: Math.round(avgTasksPerRule * 100) / 100,
    };
  }

  /**
   * Validates assignment rule configuration
   */
  validateRuleConfig(ruleType: AssignmentRuleType, config: RuleConfig): boolean {
    switch (ruleType) {
      case AssignmentRuleType.PRIORITY_BASED:
        return (config.priorities && Array.isArray(config.priorities)) || !!config.minPriority;

      case AssignmentRuleType.CASE_TYPE_BASED:
        return !!(config.caseTypes && Array.isArray(config.caseTypes));

      case AssignmentRuleType.ROUND_ROBIN:
        return true;

      case AssignmentRuleType.LOAD_BALANCED:
        return !config.maxTasksPerUser || config.maxTasksPerUser > 0;

      default:
        return false;
    }
  }

  /**
   * Logs an audit event to the audit_log table
   */
  private async logAuditEvent(
    userId: string,
    operation: string,
    entityName: string,
    actionPerformed: string,
    outcome: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: userId,
          operation,
          entity_name: entityName,
          action_performed: actionPerformed,
          outcome,
          performed_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
    }
  }
}
