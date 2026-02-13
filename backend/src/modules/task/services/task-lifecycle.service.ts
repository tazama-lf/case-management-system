import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { NotificationService } from 'src/modules/notification/notification.service';
import { CaseStatus, TaskStatus, Prisma } from '@prisma/client-cms';
import { TaskAssignedEvent, TaskUnassignedEvent, TaskStatusChangedEvent, CaseStatusChangedEvent } from '../../events/domain-events';
import { FlowableService } from 'src/modules/flowable/flowable.service';
import { CommentRepository } from 'src/modules/repository/comment.repository';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';

@Injectable()
export class TaskLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commentRepository: CommentRepository,
    private readonly logger: LoggerService,
    private readonly flowableService: FlowableService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationService: NotificationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  private async getTaskOrThrow(taskId: number) {
    const task = await this.prisma.task.findUnique({ where: { task_id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return task;
  }

  private async getCaseOrThrow(caseId: number) {
    const c = await this.prisma.case.findUnique({ where: { case_id: caseId } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    return c;
  }

  async assignTaskToInvestigator(taskId: number, assignedUserId: string, supervisorId: string, tenantId: string, note?: string) {
    this.validateAssignee(assignedUserId);
    const existingTask = await this.getTaskOrThrow(taskId);
    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    // Define investigation task names that should update case status
    const investigationTasks = ['Investigate Case', 'Investigate Fraud', 'Investigate AML'];
    const isInvestigationTask = investigationTasks.includes(existingTask.name || '');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });

      let updatedCase = existingCase;
      if (isInvestigationTask) {
        updatedCase = await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: assignedUserId, updated_at: new Date() },
        });

        await this.flowableService.handleCaseStatusChanged({
          caseId: existingTask.case_id,
          newStatus: CaseStatus.STATUS_10_ASSIGNED,
          reason: `Case assigned to investigator ${assignedUserId} by supervisor ${supervisorId}`,
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
            taskId: taskId,
            note: note,
            tenantId: tenantId,
          },
          tx,
        );
      }

      return { updatedTask, updatedCase };
    });

    // this.emitAssignment(taskId, result.updatedTask.case_id, assignedUserId, previousAssignedUserId || undefined);
    // this.emitCaseStatusChange(
    //   existingTask.case_id,
    //   previousCaseStatus,
    //   CaseStatus.STATUS_10_ASSIGNED,
    //   `Case assigned to investigator ${assignedUserId} by supervisor ${supervisorId}`,
    // );

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: supervisorId,
        actionPerformed: isInvestigationTask
          ? `Assigned task ${taskId} to investigator ${assignedUserId} and updated case ${existingTask.case_id} to ASSIGNED`
          : `Assigned task ${taskId} to user ${assignedUserId}`,
        entityName: 'TaskService',
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      taskId,
    );

    await this.notificationService.sendNotification({
      userId: assignedUserId,
      type: 'TASK_ASSIGNED',
      message: `You have been assigned to task "${existingTask.name || taskId}"`,
      metadata: { taskId, caseId: existingTask.case_id, assignedBy: supervisorId || assignedUserId, taskTitle: existingTask.name },
    });

    return result.updatedTask;
  }

  async reassignTask(taskId: number, actorUserId: string, tenantId: string, assignedUserId: string, note: string) {
    this.validateAssignee(assignedUserId);
    const existingTask = await this.getTaskOrThrow(taskId);
    const previousAssignedUserId = existingTask.assigned_user_id;
    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    const previousCaseStatus = existingCase.status;

    // Define investigation task names that should update case status
    const investigationTasks = ['Investigate Case', 'Investigate Fraud', 'Investigate AML'];
    const isInvestigationTask = investigationTasks.includes(existingTask.name || '');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });

      let updatedCase = existingCase;
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
          taskId: taskId,
          note: note,
          tenantId: tenantId,
        },
        tx,
      );
      return { updatedTask, updatedCase };
    });

    // this.emitAssignment(taskId, result.updatedTask.case_id, assignedUserId, previousAssignedUserId || undefined);
    // this.emitCaseStatusChange(
    //   existingTask.case_id,
    //   previousCaseStatus,
    //   CaseStatus.STATUS_10_ASSIGNED,
    //   `Case reassigned to investigator ${assignedUserId} by ${actorUserId}`,
    // );

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: assignedUserId,
        actionPerformed: `Task ${taskId} reassigned to investigator ${assignedUserId}`,
        entityName: 'TaskService',
        operation: 'retrieveTask',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      taskId,
    );

    return result.updatedTask;
  }

  async selfAssignTask(taskId: number, investigatorUserId: string, tenantId: string) {
    const existingTask = await this.getTaskOrThrow(taskId);
    if (existingTask.assigned_user_id) throw new BadRequestException(`Task ${taskId} is already assigned.`);
    if (existingTask.status !== TaskStatus.STATUS_01_UNASSIGNED)
      throw new BadRequestException(`Task ${taskId} must be unassigned to self-assign.`);
    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    const previousCaseStatus = existingCase.status;

    // Define investigation task names that should update case status
    const investigationTasks = ['Investigate Case', 'Investigate Fraud', 'Investigate AML'];
    const isInvestigationTask = investigationTasks.includes(existingTask.name || '');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: investigatorUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });

      let updatedCase = existingCase;
      if (isInvestigationTask) {
        updatedCase = await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: investigatorUserId, updated_at: new Date() },
        });

        await this.flowableService.handleCaseStatusChanged({
          caseId: existingTask.case_id,
          newStatus: CaseStatus.STATUS_10_ASSIGNED,
          reason: `Case self-assigned by investigator ${investigatorUserId}`,
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
        assignedUserId: investigatorUserId,
      });
      return { updatedTask, updatedCase };
    });

    // this.emitAssignment(taskId, result.updatedTask.case_id, investigatorUserId, undefined);
    // this.emitCaseStatusChange(
    //   existingTask.case_id,
    //   previousCaseStatus,
    //   CaseStatus.STATUS_10_ASSIGNED,
    //   `Case self-assigned by investigator ${investigatorUserId}`,
    // );

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: investigatorUserId,
        actionPerformed: isInvestigationTask
          ? `Self-assigned task ${taskId} and updated case ${existingTask.case_id} to ASSIGNED`
          : `Self-assigned task ${taskId}`,
        entityName: 'TaskService',
        operation: 'selfAssignTask',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      taskId,
    );

    return result.updatedTask;
  }

  async unassignTask(taskId: number, actorUserId: string, tenantId: string, reason: string) {
    if (!reason || !reason.trim()) throw new BadRequestException('Reason for unassigning task is required');
    const existingTask = await this.getTaskOrThrow(taskId);
    if (existingTask.status === TaskStatus.STATUS_30_COMPLETED)
      throw new BadRequestException(`Cannot unassign a completed task (${taskId})`);
    if (!existingTask.assigned_user_id) throw new BadRequestException(`Task ${taskId} is already unassigned`);

    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    const previousCaseStatus = existingCase.status;

    const result = await this.prisma.$transaction(async (tx) => {
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

          if (updatedCase.status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT && subCase?.status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT) {

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
          taskId: taskId,
          note: reason,
          tenantId: tenantId,
        },
        tx,
      );

      return { updatedTask };
    });

    // const candidateGroup = existingTask.candidateGroup?.toLowerCase() || '';
    // this.eventEmitter.emit(
    //   'task.unassigned',
    //   new TaskUnassignedEvent(taskId, result.updatedTask.case_id, existingTask.assigned_user_id || undefined, candidateGroup, reason),
    // );
    // this.emitCaseStatusChange(
    //   existingTask.case_id,
    //   previousCaseStatus,
    //   CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    //   `Task unassigned. Reason: ${reason}`,
    // );

    try {
      if (existingTask.assigned_user_id) {
        await this.notificationService.sendNotification({
          userId: existingTask.assigned_user_id,
          type: 'TASK_UNASSIGNED',
          message: `Task "${existingTask.name || taskId}" has been unassigned. Reason: ${reason}`,
          metadata: { taskId, caseId: existingTask.case_id, unassignedBy: actorUserId, reason, taskTitle: existingTask.name },
        });
      }
      // if (candidateGroup) {
      //   await this.notificationService.sendGroupNotification({
      //     candidateGroup,
      //     type: 'TASK_AVAILABLE',
      //     message: `Task "${existingTask.name || taskId}" is now available in the ${candidateGroup} work queue`,
      //     metadata: { taskId, caseId: existingTask.case_id, unassignmentReason: reason },
      //   });
      // }
    } catch (e) {
      this.logger.warn(`Failed notifications for unassign: ${e.message}`, TaskLifecycleService.name);
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
      taskId,
    );

    return {
      ...result.updatedTask,
      // message: `Task successfully unassigned and returned to ${candidateGroup} work queue`,
      // candidateGroup,
      unassignmentReason: reason,
    };
  }

  // async releaseTask(taskId: string, actorUserId: string) {
  //   const existingTask = await this.getTaskOrThrow(taskId);
  //   const previousAssignedUserId = existingTask.assigned_user_id;
  //   const updatedTask = await this.prisma.task.update({
  //     where: { task_id: taskId },
  //     data: { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED },
  //     include: { case: true },
  //   });
  //   this.eventEmitter.emit(
  //     'task.unassigned',
  //     new TaskUnassignedEvent(taskId, updatedTask.case_id, previousAssignedUserId || undefined, existingTask.candidateGroup || undefined),
  //   );
  //   await this.auditLogService.logAction({
  //     userId: actorUserId,
  //     actionPerformed: `Released task ${taskId}`,
  //     entityName: 'TaskService',
  //     operation: 'releaseTask',
  //     outcome: 'SUCCESS',
  //     performedAt: new Date(),
  //   });
  //   return updatedTask;
  // }

  async completeTask(taskId: number, actorUserId: string) {
    const existingTask = await this.getTaskOrThrow(taskId);
    const updatedTask = await this.prisma.task.update({
      where: { task_id: taskId },
      data: { status: TaskStatus.STATUS_30_COMPLETED },
      include: { case: true },
    });
    // await this.flowableService.handleTaskCompleted({
    //   caseId: existingTask.case_id,
    //   taskName: existingTask.name!,
    //   newStatus: TaskStatus.STATUS_30_COMPLETED,
    // });
    // this.eventEmitter.emit(
    //   'task.status.changed',
    //   new TaskStatusChangedEvent(
    //     taskId,
    //     updatedTask.case_id,
    //     updatedTask.name || '',
    //     TaskStatus.STATUS_30_COMPLETED,
    //     updatedTask.assigned_user_id || undefined,
    //   ),
    // );
    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: actorUserId,
        actionPerformed: `Completed task ${taskId}`,
        entityName: 'TaskService',
        operation: 'completeTask',
        outcome: Outcome.SUCCESS,
      },
      existingTask.case_id,
      taskId,
    );

    return updatedTask;
  }

  private emitAssignment(taskId: number, caseId: number, assignedUserId: string, previousAssignedUserId?: string) {
    this.eventEmitter.emit('task.assigned', new TaskAssignedEvent(taskId, caseId, assignedUserId, previousAssignedUserId || undefined));
  }

  private emitCaseStatusChange(caseId: number, prev: CaseStatus, next: CaseStatus, reason: string) {
    this.eventEmitter.emit('case.status.changed', new CaseStatusChangedEvent(caseId, next, reason));
  }

  private validateAssignee(id: string) {
    if (!id) throw new BadRequestException('Assigned user ID cannot be null or undefined');
  }
}
