import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

interface Task {
  task_id: string;
  name: string | null;
  status: TaskStatus;
  assigned_user_id: string | null;
  created_at?: Date;
  case_id?: string;
}

export interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TaskFilterOptions {
  excludeTaskIds?: string[];
  excludeStatuses?: TaskStatus[];
}

export class TaskValidationUtil {
  static readonly TASK_NAMES = {
    INVESTIGATE_CASE: ['Investigate Case', 'Investigate case'],
    APPROVE_CASE_CLOSURE: 'Approve case closure',
  } as const;

  static findApprovalTask(tasks: Task[]): Task | undefined {
    return tasks.find((task) => task.name === TaskValidationUtil.TASK_NAMES.APPROVE_CASE_CLOSURE);
  }

  static filterTasks(tasks: Task[], options: TaskFilterOptions = {}): Task[] {
    let filteredTasks = [...tasks];

    if (options.excludeTaskIds?.length) {
      filteredTasks = filteredTasks.filter((task) => !options.excludeTaskIds!.includes(task.task_id));
    }

    if (options.excludeStatuses?.length) {
      filteredTasks = filteredTasks.filter((task) => !options.excludeStatuses!.includes(task.status));
    }

    return filteredTasks;
  }

  static getUserAssignedTasks(tasks: Task[], userId: string): Task[] {
    return tasks.filter((task) => task.assigned_user_id === userId);
  }

  static validateApprovalTaskForClosure(tasks: Task[]): TaskValidationResult {
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

  static validateOtherTasksCompleted(tasks: Task[], excludeTaskIds: string[] = []): TaskValidationResult {
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

  static getTaskStatusCounts(tasks: Task[]) {
    const completed = tasks.filter((t) => t.status === TaskStatus.STATUS_30_COMPLETED).length;
    const pending = tasks.filter((t) => t.status !== TaskStatus.STATUS_30_COMPLETED).length;

    return {
      completed,
      pending,
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