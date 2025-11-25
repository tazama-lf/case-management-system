import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { NotificationService } from 'src/modules/notification/notification.service';
import { CaseStatus, TaskStatus, Prisma, WorkQueue } from '@prisma/client';
import { TaskAssignedEvent, TaskUnassignedEvent, TaskStatusChangedEvent, CaseStatusChangedEvent } from '../../events/domain-events';

@Injectable()
export class TaskLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationService: NotificationService,
  ) {}

  private async getTaskOrThrow(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { task_id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return task;
  }

  private async getCaseOrThrow(caseId: string) {
    const c = await this.prisma.case.findUnique({ where: { case_id: caseId } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);
    return c;
  }

  async assignTaskToInvestigator(taskId: string, assignedUserId: string, supervisorId: string, tenantId: string) {
    this.validateAssignee(assignedUserId);
    const existingTask = await this.getTaskOrThrow(taskId);
    const previousAssignedUserId = existingTask.assigned_user_id;
    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    const previousCaseStatus = existingCase.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });
      const updatedCase = await tx.case.update({
        where: { case_id: existingTask.case_id },
        data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: assignedUserId, updated_at: new Date() },
      });
      return { updatedTask, updatedCase };
    });

    this.emitAssignment(taskId, result.updatedTask.case_id, assignedUserId, previousAssignedUserId || undefined);
    this.emitCaseStatusChange(
      existingTask.case_id,
      previousCaseStatus,
      CaseStatus.STATUS_10_ASSIGNED,
      `Case assigned to investigator ${assignedUserId} by supervisor ${supervisorId}`,
    );

    await this.auditLogService.logAction({
      userId: supervisorId,
      actionPerformed: `Assigned task ${taskId} to investigator ${assignedUserId} and updated case ${existingTask.case_id} to ASSIGNED`,
      entityName: 'TaskService',
      operation: 'assignTaskToInvestigator',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });

    await this.auditLogService.logAction({
      userId: assignedUserId,
      actionPerformed: `Task ${taskId} assigned to investigator ${assignedUserId}`,
      entityName: 'TaskService',
      operation: 'retrieveTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });

    return result.updatedTask;
  }

  async reassignTask(taskId: string, actorUserId: string, tenantId: string, assignedUserId: string) {
    this.validateAssignee(assignedUserId);
    const existingTask = await this.getTaskOrThrow(taskId);
    const previousAssignedUserId = existingTask.assigned_user_id;
    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    const previousCaseStatus = existingCase.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: assignedUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });
      const updatedCase = await tx.case.update({
        where: { case_id: existingTask.case_id },
        data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: assignedUserId, updated_at: new Date() },
      });
      return { updatedTask, updatedCase };
    });

    this.emitAssignment(taskId, result.updatedTask.case_id, assignedUserId, previousAssignedUserId || undefined);
    this.emitCaseStatusChange(
      existingTask.case_id,
      previousCaseStatus,
      CaseStatus.STATUS_10_ASSIGNED,
      `Case reassigned to investigator ${assignedUserId} by ${actorUserId}`,
    );

    await this.auditLogService.logAction({
      userId: actorUserId,
      actionPerformed: `Reassigned task ${taskId} to investigator ${assignedUserId} and updated case ${existingTask.case_id} to ASSIGNED`,
      entityName: 'TaskService',
      operation: 'reassignTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });

    await this.auditLogService.logAction({
      userId: assignedUserId,
      actionPerformed: `Task ${taskId} reassigned to investigator ${assignedUserId}`,
      entityName: 'TaskService',
      operation: 'retrieveTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });

    return result.updatedTask;
  }

  async selfAssignTask(taskId: string, investigatorUserId: string, tenantId: string) {
    const existingTask = await this.getTaskOrThrow(taskId);
    if (existingTask.assigned_user_id) throw new BadRequestException(`Task ${taskId} is already assigned.`);
    if (existingTask.status !== TaskStatus.STATUS_01_UNASSIGNED)
      throw new BadRequestException(`Task ${taskId} must be unassigned to self-assign.`);
    const existingCase = await this.getCaseOrThrow(existingTask.case_id);
    const previousCaseStatus = existingCase.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { task_id: taskId },
        data: { assigned_user_id: investigatorUserId, status: TaskStatus.STATUS_10_ASSIGNED, updated_at: new Date() },
      });
      const updatedCase = await tx.case.update({
        where: { case_id: existingTask.case_id },
        data: { status: CaseStatus.STATUS_10_ASSIGNED, case_owner_user_id: investigatorUserId, updated_at: new Date() },
      });
      return { updatedTask, updatedCase };
    });

    this.emitAssignment(taskId, result.updatedTask.case_id, investigatorUserId, undefined);
    this.emitCaseStatusChange(
      existingTask.case_id,
      previousCaseStatus,
      CaseStatus.STATUS_10_ASSIGNED,
      `Case self-assigned by investigator ${investigatorUserId}`,
    );

    await this.auditLogService.logAction({
      userId: investigatorUserId,
      actionPerformed: `Self-assigned task ${taskId} and updated case ${existingTask.case_id} to ASSIGNED`,
      entityName: 'TaskService',
      operation: 'selfAssignTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });

    return result.updatedTask;
  }

  async unassignTask(taskId: string, actorUserId: string, tenantId: string, reason: string) {
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
      const updatedCase = await tx.case.update({
        where: { case_id: existingTask.case_id },
        data: { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, case_owner_user_id: null, updated_at: new Date() },
      });
      return { updatedTask, updatedCase };
    });

    const candidateGroup = existingTask.candidateGroup?.toLowerCase() || '';
    this.eventEmitter.emit(
      'task.unassigned',
      new TaskUnassignedEvent(taskId, result.updatedTask.case_id, existingTask.assigned_user_id || undefined, candidateGroup, reason),
    );
    this.emitCaseStatusChange(
      existingTask.case_id,
      previousCaseStatus,
      CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      `Task unassigned. Reason: ${reason}`,
    );

    try {
      if (existingTask.assigned_user_id) {
        await this.notificationService.sendNotification({
          userId: existingTask.assigned_user_id,
          type: 'TASK_UNASSIGNED',
          message: `Task "${existingTask.name || taskId}" has been unassigned. Reason: ${reason}`,
          metadata: { taskId, caseId: existingTask.case_id, unassignedBy: actorUserId, reason, candidateGroup },
        });
      }
      if (candidateGroup) {
        await this.notificationService.sendGroupNotification({
          candidateGroup,
          type: 'TASK_AVAILABLE',
          message: `Task "${existingTask.name || taskId}" is now available in the ${candidateGroup} work queue`,
          metadata: { taskId, caseId: existingTask.case_id, unassignmentReason: reason },
        });
      }
    } catch (e) {
      this.logger.warn(`Failed notifications for unassign: ${e.message}`, TaskLifecycleService.name);
    }

    await this.auditLogService.logAction({
      userId: actorUserId,
      actionPerformed: `Unassigned task ${taskId} from user ${existingTask.assigned_user_id}. Task returned to ${candidateGroup}. Reason: ${reason}`,
      entityName: 'TaskService',
      operation: 'unassignTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });

    return {
      ...result.updatedTask,
      message: `Task successfully unassigned and returned to ${candidateGroup} work queue`,
      candidateGroup,
      unassignmentReason: reason,
    };
  }

  async releaseTask(taskId: string, actorUserId: string) {
    const existingTask = await this.getTaskOrThrow(taskId);
    const previousAssignedUserId = existingTask.assigned_user_id;
    const updatedTask = await this.prisma.task.update({
      where: { task_id: taskId },
      data: { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED },
      include: { case: true },
    });
    this.eventEmitter.emit(
      'task.unassigned',
      new TaskUnassignedEvent(taskId, updatedTask.case_id, previousAssignedUserId || undefined, existingTask.candidateGroup || undefined),
    );
    await this.auditLogService.logAction({
      userId: actorUserId,
      actionPerformed: `Released task ${taskId}`,
      entityName: 'TaskService',
      operation: 'releaseTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });
    return updatedTask;
  }

  async completeTask(taskId: string, actorUserId: string) {
    const existingTask = await this.getTaskOrThrow(taskId);
    const updatedTask = await this.prisma.task.update({
      where: { task_id: taskId },
      data: { status: TaskStatus.STATUS_30_COMPLETED },
      include: { case: true },
    });
    this.eventEmitter.emit(
      'task.status.changed',
      new TaskStatusChangedEvent(
        taskId,
        updatedTask.case_id,
        updatedTask.name || '',
        TaskStatus.STATUS_30_COMPLETED,
        updatedTask.assigned_user_id || undefined,
      ),
    );
    await this.auditLogService.logAction({
      userId: actorUserId,
      actionPerformed: `Completed task ${taskId}`,
      entityName: 'TaskService',
      operation: 'completeTask',
      outcome: 'SUCCESS',
      performedAt: new Date(),
    });
    return updatedTask;
  }

  async reassignTaskToWorkQueue(
    taskId: string,
    targetWorkQueueId: string,
    userId: string,
    tenantId: string,
    reason?: string,
    assignedUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { task_id: taskId },
        include: {
          workQueue: { select: { work_queue_id: true, name: true } },
          case: { select: { case_id: true, tenant_id: true, status: true } },
        },
      });
      if (!task) throw new NotFoundException(`Task ${taskId} not found`);
      if (task.case.tenant_id !== tenantId) throw new ForbiddenException('Task does not belong to your organization');
      if (task.status === TaskStatus.STATUS_20_IN_PROGRESS && task.assigned_user_id)
        throw new BadRequestException('Cannot reassign in-progress task');

      const targetQueue = await tx.workQueue.findUnique({
        where: { work_queue_id: targetWorkQueueId },
        select: { work_queue_id: true, name: true, tenant_id: true, is_active: true },
      });
      if (!targetQueue) throw new NotFoundException(`Target work queue ${targetWorkQueueId} not found`);
      if (targetQueue.tenant_id !== tenantId) throw new ForbiddenException('Target work queue does not belong to your organization');
      if (!targetQueue.is_active) throw new BadRequestException(`Target work queue '${targetQueue.name}' is not active`);
      if (task.work_queue_id === targetWorkQueueId) throw new BadRequestException(`Task is already in work queue '${targetQueue.name}'`);

      if (assignedUserId) {
        const memberAssignment = await tx.workQueueMember.findUnique({
          where: { work_queue_id_user_id: { work_queue_id: targetWorkQueueId, user_id: assignedUserId } },
        });
        if (!memberAssignment)
          throw new BadRequestException(`User ${assignedUserId} is not assigned to target work queue '${targetQueue.name}'`);
      }

      const oldWorkQueueId = task.work_queue_id;
      const oldWorkQueueName = task.workQueue?.name || null;
      const previousAssignedUserId = task.assigned_user_id || undefined;

      const updateData: any = { work_queue_id: targetWorkQueueId, updated_at: new Date() };
      if (assignedUserId) {
        updateData.assigned_user_id = assignedUserId;
        updateData.status = TaskStatus.STATUS_10_ASSIGNED;
      } else if (task.assigned_user_id) {
        updateData.assigned_user_id = null;
        updateData.status = TaskStatus.STATUS_01_UNASSIGNED;
      }

      const updatedTask = await tx.task.update({ where: { task_id: taskId }, data: updateData });

      const auditDescription = reason
        ? `Reassigned task from '${oldWorkQueueName || 'unassigned'}' to '${targetQueue.name}'. Reason: ${reason}`
        : `Reassigned task from '${oldWorkQueueName || 'unassigned'}' to '${targetQueue.name}'`;
      await this.auditLogService.logAction({
        userId,
        actionPerformed: auditDescription,
        entityName: 'Task',
        operation: 'REASSIGN_TASK',
        outcome: 'SUCCESS',
        performedAt: new Date(),
      });

      this.eventEmitter.emit('task.reassigned', {
        taskId: task.task_id,
        caseId: task.case_id,
        taskName: task.name || 'Unnamed Task',
        oldWorkQueueId,
        newWorkQueueId: targetWorkQueueId,
        oldWorkQueueName,
        newWorkQueueName: targetQueue.name,
        reassignedBy: userId,
        tenantId,
        reason,
        assignedUserId,
        previousAssignedUserId,
        timestamp: new Date(),
      });

      return {
        taskId: updatedTask.task_id,
        oldWorkQueueId,
        oldWorkQueueName,
        newWorkQueueId: targetQueue.work_queue_id,
        newWorkQueueName: targetQueue.name,
        status: updatedTask.status,
        assignedUserId: updatedTask.assigned_user_id || undefined,
        reason,
        reassignedAt: updatedTask.updated_at,
        reassignedBy: userId,
      };
    });
  }

  private emitAssignment(taskId: string, caseId: string, assignedUserId: string, previousAssignedUserId?: string) {
    this.eventEmitter.emit('task.assigned', new TaskAssignedEvent(taskId, caseId, assignedUserId, previousAssignedUserId || undefined));
  }

  private emitCaseStatusChange(caseId: string, prev: CaseStatus, next: CaseStatus, reason: string) {
    this.eventEmitter.emit('case.status.changed', new CaseStatusChangedEvent(caseId, next, reason));
  }

  private validateAssignee(id: string) {
    if (!id) throw new BadRequestException('Assigned user ID cannot be null or undefined');
  }
}
