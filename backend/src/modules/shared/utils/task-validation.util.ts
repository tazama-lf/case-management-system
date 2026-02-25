import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client-cms';
import { TASK_NAMES } from 'src/constants/case.constants';

interface Task {
  task_id: number;
  name: string | null;
  status: TaskStatus;
  assigned_user_id: string | null;
  created_at?: Date;
  case_id?: number;
}

export interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ApprovalTaskValidationOptions {
  requireClaim?: boolean;
  expectedAssignee?: string;
}

export interface TaskFilterOptions {
  excludeTaskIds?: number[];
  excludeStatuses?: TaskStatus[];
}

@Injectable()
export class TaskValidationUtil {
  findApprovalTask(tasks: Task[]): Task | undefined {
    return tasks.find((task) => task.name?.toLowerCase() === TASK_NAMES.APPROVE_CASE_CLOSURE.toLowerCase());
  }

  filterTasks(tasks: Task[], options: TaskFilterOptions = {}): Task[] {
    let filteredTasks = [...tasks];

    if (options.excludeTaskIds?.length) {
      filteredTasks = filteredTasks.filter((task) => !options.excludeTaskIds!.includes(task.task_id));
    }

    if (options.excludeStatuses?.length) {
      filteredTasks = filteredTasks.filter((task) => !options.excludeStatuses!.includes(task.status));
    }

    return filteredTasks;
  }

  getUserAssignedTasks(tasks: Task[], userId: string): Task[] {
    return tasks.filter((task) => task.assigned_user_id === userId);
  }

  validateApprovalTaskForClosure(
    tasks: Task[],
    options: ApprovalTaskValidationOptions = {},
  ): TaskValidationResult & { approvalTask?: Task } {
    const errors: string[] = [];
    const approvalTask = this.findApprovalTask(tasks);

    if (approvalTask) {
      const allowedStatuses: TaskStatus[] = [
        TaskStatus.STATUS_01_UNASSIGNED,
        TaskStatus.STATUS_10_ASSIGNED,
        TaskStatus.STATUS_20_IN_PROGRESS,
      ];

      if (!allowedStatuses.includes(approvalTask.status)) {
        errors.push(`Approval task is in an invalid status (${approvalTask.status})`);
      }

      if (options.requireClaim && approvalTask.status === TaskStatus.STATUS_01_UNASSIGNED) {
        errors.push('Approval task must be claimed before performing this action');
      }

      if (options.expectedAssignee) {
        if (!approvalTask.assigned_user_id) {
          errors.push('Approval task must be claimed by a supervisor before proceeding');
        } else if (approvalTask.assigned_user_id !== options.expectedAssignee) {
          errors.push('Approval task is claimed by a different supervisor');
        }
      }
    } else {
      errors.push('Approval task not found');
    }

    return {
      isValid: errors.length === 0,
      errors,
      approvalTask,
    };
  }

  validateOtherTasksCompleted(tasks: Task[], excludeTaskIds: number[] = []): TaskValidationResult {
    const errors: string[] = [];
    const incompleteTasks = this.filterTasks(tasks, {
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

  getTaskStatusCounts(tasks: Task[]): { completed: number; pending: number; total: number } {
    const completed = tasks.filter((t) => t.status === TaskStatus.STATUS_30_COMPLETED).length;
    const pending = tasks.filter((t) => t.status !== TaskStatus.STATUS_30_COMPLETED).length;

    return {
      completed,
      pending,
      total: tasks.length,
    };
  }

  throwIfValidationFails(validationResult: TaskValidationResult, baseMessage = 'Task validation failed'): void {
    if (!validationResult.isValid) {
      throw new BadRequestException({
        message: baseMessage,
        errors: validationResult.errors,
      });
    }
  }
}
