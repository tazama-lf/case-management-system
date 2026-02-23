import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { NotificationService } from 'src/modules/notification/notification.service';
import { Case, CaseStatus, TaskStatus, Task } from '@prisma/client-cms';
import { FlowableService } from 'src/modules/flowable/flowable.service';
import { CommentRepository } from 'src/modules/repository/comment.repository';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { TASK_NAMES } from 'src/constants/case.constants';
import { TaskRepository } from 'src/modules/repository/task.repository';
import { CaseRepository } from 'src/modules/repository/case.repository';

@Injectable()
export class TaskLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskRepository: TaskRepository,
    private readonly caseRepository: CaseRepository,
    private readonly commentRepository: CommentRepository,
    private readonly logger: LoggerService,
    private readonly flowableService: FlowableService,
    private readonly notificationService: NotificationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async assignTaskToInvestigator(taskId: number, assignedUserId: string, userId: string, tenantId: string, note?: string): Promise<Task> {
    const { existingTask, existingCase, isInvestigationTask } = await this.fetchTaskAndCase(taskId, tenantId);

    const result = await this.taskRepository.transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });

      let updatedCase: Case = existingCase;
      if (isInvestigationTask) {
        updatedCase = await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: assignedUserId, updated_at: new Date() },
        });

        await this.flowableService.handleCaseStatusChanged({
          caseId: existingTask.case_id,
          newStatus: CaseStatus.STATUS_10_ASSIGNED,
          reason: `Case assigned to investigator ${assignedUserId} by user ${userId}`,
        });

        if (updatedCase.parent_id) {
          const subCase = await tx.case.findFirst({
            where: {
              parent_id: updatedCase.parent_id,
              NOT: {
                case_id: updatedCase.case_id,
              },
            },
          });

          if (updatedCase.status === CaseStatus.STATUS_10_ASSIGNED && subCase?.status === CaseStatus.STATUS_10_ASSIGNED) {
            await tx.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
            });
          }
        }
      }

      await this.flowableService.handleTaskAssigned({
        taskId,
        caseId: existingTask.case_id,
        taskName: existingTask.name!,
        assignedUserId,
      });
      if (note && note.trim().length > 0) {
        await this.commentRepository.createComment(
          assignedUserId,
          {
            caseId: existingTask.case_id,
            taskId,
            note,
            tenantId,
          },
          tx,
        );
      }

      return { updatedTask, updatedCase };
    });

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId,
        actionPerformed: isInvestigationTask
          ? `Assigned task ${taskId} to investigator ${assignedUserId} and updated case ${existingTask.case_id} to ASSIGNED`
          : `Assigned task ${taskId} to user ${assignedUserId}`,
        entityName: 'TaskService',
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      existingTask.tenant_id,
      taskId,
    );

    await this.notificationService.sendNotification({
      userId: assignedUserId,
      type: 'TASK_ASSIGNED',
      message: `You have been assigned to task "${existingTask.name ?? taskId}"`,
      metadata: { taskId, caseId: existingTask.case_id, assignedBy: userId || assignedUserId, taskTitle: existingTask.name },
    });

    return result.updatedTask;
  }

  async reassignTask(taskId: number, actorUserId: string, tenantId: string, assignedUserId: string, note: string): Promise<Task> {
    const { existingTask, existingCase, isInvestigationTask } = await this.fetchTaskAndCase(taskId, tenantId);

    const result = await this.taskRepository.transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });

      let updatedCase: Case = existingCase;
      if (isInvestigationTask) {
        updatedCase = await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: assignedUserId, updated_at: new Date() },
        });

        await this.flowableService.handleCaseStatusChanged({
          caseId: existingTask.case_id,
          newStatus: CaseStatus.STATUS_10_ASSIGNED,
          reason: `Case assigned to investigator ${assignedUserId}`,
        });

        if (updatedCase.parent_id) {
          const subCase = await tx.case.findFirst({
            where: {
              parent_id: updatedCase.parent_id,
              NOT: {
                case_id: updatedCase.case_id,
              },
            },
          });

          if (updatedCase.status === CaseStatus.STATUS_10_ASSIGNED && subCase?.status === CaseStatus.STATUS_10_ASSIGNED) {
            await tx.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
            });
          }
        }
      }

      await this.flowableService.handleTaskUnassigned({
        taskId,
        caseId: existingTask.case_id,
        taskName: existingTask.name!,
        assignedUser: null,
      });

      await this.flowableService.handleTaskAssigned({
        taskId,
        caseId: existingTask.case_id,
        taskName: existingTask.name!,
        assignedUserId,
      });

      await this.commentRepository.createComment(
        actorUserId,
        {
          caseId: existingTask.case_id,
          taskId,
          note,
          tenantId,
        },
        tx,
      );
      return { updatedTask, updatedCase };
    });

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: assignedUserId,
        actionPerformed: `Task ${taskId} reassigned to investigator ${assignedUserId}`,
        entityName: 'TaskService',
        operation: 'retrieveTask',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      existingTask.tenant_id,
      taskId,
    );

    return result.updatedTask;
  }

  async unassignTask(
    taskId: number,
    actorUserId: string,
    tenantId: string,
    reason: string,
  ): Promise<Task & { unassignmentReason: string }> {
    const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
    if (!existingTask) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    if (existingTask.status === TaskStatus.STATUS_30_COMPLETED) {
      throw new BadRequestException(`Cannot unassign a completed task (${taskId})`);
    }
    if (!existingTask.assigned_user_id) {
      throw new BadRequestException(`Task ${taskId} is already unassigned`);
    }

    const result = await this.taskRepository.transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED },
      });

      if (updatedTask.name !== 'SAR/STR Filing') {
        const updatedCase = await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, case_owner_user_id: null, updated_at: new Date() },
        });

        if (updatedCase.parent_id) {
          const subCase = await tx.case.findFirst({
            where: {
              parent_id: updatedCase.parent_id,
              NOT: {
                case_id: updatedCase.case_id,
              },
            },
          });

          if (
            updatedCase.status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT &&
            subCase?.status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT
          ) {
            await tx.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, updated_at: new Date() },
            });
          }
        }
      }

      await this.flowableService.handleCaseStatusChanged({
        caseId: existingTask.case_id,
        newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        reason: `Task unassigned. Reason: ${reason}`,
      });
      await this.flowableService.handleTaskUnassigned({
        taskId,
        caseId: existingTask.case_id,
        taskName: existingTask.name!,
        assignedUser: null,
      });

      await this.commentRepository.createComment(
        actorUserId,
        {
          caseId: existingTask.case_id,
          taskId,
          note: reason,
          tenantId,
        },
        tx,
      );

      return { updatedTask };
    });

    try {
      if (existingTask.assigned_user_id) {
        await this.notificationService.sendNotification({
          userId: existingTask.assigned_user_id,
          type: 'TASK_UNASSIGNED',
          message: `Task "${existingTask.name ?? taskId}" has been unassigned. Reason: ${reason}`,
          metadata: { taskId, caseId: existingTask.case_id, unassignedBy: actorUserId, reason, taskTitle: existingTask.name },
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      this.logger.warn(`Failed notifications for unassign: ${errorMessage}`, errorStack, TaskLifecycleService.name);
    }

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: actorUserId,
        actionPerformed: `Unassigned task ${taskId} from user ${existingTask.assigned_user_id}.`,
        entityName: 'TaskService',
        operation: 'unassignTask',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      existingTask.tenant_id,
      taskId,
    );

    return {
      ...result.updatedTask,
      unassignmentReason: reason,
    };
  }

  async completeTask(taskId: number, actorUserId: string, tenantId: string): Promise<Task> {
    const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
    if (!existingTask) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    const updatedTask = await this.prisma.task.update({
      where: { task_id: taskId },
      data: { status: TaskStatus.STATUS_30_COMPLETED },
      include: { case: true },
    });
    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: actorUserId,
        actionPerformed: `Completed task ${taskId}`,
        entityName: 'TaskService',
        operation: 'completeTask',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      existingTask.tenant_id,
      taskId,
    );

    return updatedTask;
  }

  private async fetchTaskAndCase(
    taskId: number,
    tenantId: string,
  ): Promise<{ existingTask: Task; existingCase: Case; isInvestigationTask: boolean }> {
    const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
    if (!existingTask) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    const existingCase = await this.caseRepository.findCaseById(existingTask.case_id, tenantId);
    const isInvestigationTask = existingTask.name === TASK_NAMES.INVESTIGATE_CASE;
    return { existingTask, existingCase, isInvestigationTask };
  }
}
