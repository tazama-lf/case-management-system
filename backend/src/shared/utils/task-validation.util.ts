import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

export interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TaskFilterOptions {
  excludeTaskIds?: string[];
  includeTaskIds?: string[];
  statuses?: TaskStatus[];
  excludeStatuses?: TaskStatus[];
  assignedUserId?: string;
  unassignedOnly?: boolean;
}

/**
 * Utility class for common task validation and filtering operations
 * Extracts recurring task validation logic used across case and task services
 */
export class TaskValidationUtil {
  static readonly TASK_NAMES = {
    INVESTIGATE_CASE: ['Investigate Case', 'Investigate case'],
    APPROVE_CASE_CLOSURE: 'Approve case closure',
    TRIAGE_ALERT: 'Triage Alert',
  } as const;

  static findInvestigationTask(tasks: any[]): any | undefined {
    return tasks.find((task) => TaskValidationUtil.TASK_NAMES.INVESTIGATE_CASE.includes(task.name));
  }

  static findApprovalTask(tasks: any[]): any | undefined {
    return tasks.find((task) => task.name === TaskValidationUtil.TASK_NAMES.APPROVE_CASE_CLOSURE);
  }

  static findTasksByName(tasks: any[], taskName: string): any[] {
    return tasks.filter((task) => task.name === taskName);
  }

  static filterTasks(tasks: any[], options: TaskFilterOptions = {}): any[] {
    let filteredTasks = [...tasks];

    if (options.excludeTaskIds?.length) {
      filteredTasks = filteredTasks.filter((task) => !options.excludeTaskIds!.includes(task.task_id));
    }

    if (options.includeTaskIds?.length) {
      filteredTasks = filteredTasks.filter((task) => options.includeTaskIds!.includes(task.task_id));
    }

    if (options.statuses?.length) {
      filteredTasks = filteredTasks.filter((task) => options.statuses!.includes(task.status));
    }

    if (options.excludeStatuses?.length) {
      filteredTasks = filteredTasks.filter((task) => !options.excludeStatuses!.includes(task.status));
    }

    if (options.assignedUserId) {
      filteredTasks = filteredTasks.filter((task) => task.assigned_user_id === options.assignedUserId);
    }

    if (options.unassignedOnly) {
      filteredTasks = filteredTasks.filter((task) => !task.assigned_user_id);
    }

    return filteredTasks;
  }

  static getCompletedTasks(tasks: any[]): any[] {
    return TaskValidationUtil.filterTasks(tasks, {
      statuses: [TaskStatus.STATUS_30_COMPLETED],
    });
  }

  static getIncompleteTasks(tasks: any[]): any[] {
    return TaskValidationUtil.filterTasks(tasks, {
      excludeStatuses: [TaskStatus.STATUS_30_COMPLETED],
    });
  }

  static getUserAssignedTasks(tasks: any[], userId: string): any[] {
    return TaskValidationUtil.filterTasks(tasks, {
      assignedUserId: userId,
    });
  }

  static getUnassignedTasks(tasks: any[]): any[] {
    return TaskValidationUtil.filterTasks(tasks, {
      unassignedOnly: true,
    });
  }

  static validateInvestigationTaskForClosure(tasks: any[]): TaskValidationResult {
    const errors: string[] = [];
    const investigationTask = TaskValidationUtil.findInvestigationTask(tasks);

    if (!investigationTask) {
      errors.push('Investigation task not found');
    } else if (investigationTask.status !== TaskStatus.STATUS_20_IN_PROGRESS) {
      errors.push(`Investigation task must be in progress (current: ${investigationTask.status})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateApprovalTaskForClosure(tasks: any[]): TaskValidationResult {
    const errors: string[] = [];
    const approvalTask = TaskValidationUtil.findApprovalTask(tasks);

    if (!approvalTask) {
      errors.push('Approval task not found');
    } else if (approvalTask.status !== TaskStatus.STATUS_01_UNASSIGNED) {
      errors.push(`Approval task must be unassigned to proceed (current: ${approvalTask.status})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateOtherTasksCompleted(tasks: any[], excludeTaskIds: string[] = []): TaskValidationResult {
    const errors: string[] = [];
    const incompleteTasks = TaskValidationUtil.filterTasks(tasks, {
      excludeTaskIds,
      excludeStatuses: [TaskStatus.STATUS_30_COMPLETED],
    });

    if (incompleteTasks.length > 0) {
      errors.push(`All other tasks must be completed. Incomplete tasks: ${incompleteTasks.map((t) => t.name).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateCaseClosurePreconditions(tasks: any[]): TaskValidationResult {
    const allErrors: string[] = [];

    const investigationValidation = TaskValidationUtil.validateInvestigationTaskForClosure(tasks);
    allErrors.push(...investigationValidation.errors);

    const investigationTask = TaskValidationUtil.findInvestigationTask(tasks);
    const excludeIds = investigationTask ? [investigationTask.task_id] : [];

    const otherTasksValidation = TaskValidationUtil.validateOtherTasksCompleted(tasks, excludeIds);
    allErrors.push(...otherTasksValidation.errors);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  static getTaskStatusCounts(tasks: any[]) {
    return {
      completed: TaskValidationUtil.getCompletedTasks(tasks).length,
      pending: TaskValidationUtil.getIncompleteTasks(tasks).length,
      unassigned: TaskValidationUtil.getUnassignedTasks(tasks).length,
      total: tasks.length,
    };
  }

  static throwIfValidationFails(validationResult: TaskValidationResult, baseMessage = 'Task validation failed'): void {
    if (!validationResult.isValid) {
      throw new BadRequestException({
        message: baseMessage,
        errors: validationResult.errors,
      });
    }
  }
}
