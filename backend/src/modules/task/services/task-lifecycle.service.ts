import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
import { setTimeout } from 'node:timers/promises';
import { RbacService, EndpointKey } from 'src/utils/rbac/rbacHelper';
import type { AuthenticatedUser } from 'src/utils/types/auth.types';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class TaskLifecycleService {
  private readonly rbacService = new RbacService();

  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly caseRepository: CaseRepository,
    private readonly commentRepository: CommentRepository,
    private readonly logger: LoggerService,
    private readonly flowableService: FlowableService,
    private readonly notificationService: NotificationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly userService: UserService,
  ) {}

  async assignTaskToInvestigator(
    taskId: number,
    assignedUserId: string,
    userId: string,
    tenantId: string,
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
    note?: string,
  ): Promise<Task> {
    const { existingTask, existingCase, isInvestigationTask } = await this.fetchTaskAndCase(taskId, tenantId);

    const rbacRole = this.rbacService.getRoleFromUser(user);
    const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: existingCase.status });
    if (!t2.allowed) throw new ForbiddenException(t2.reason);

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
        });
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

    const { token, tenantName } = user;
    const fullname = await this.fetchUserDetails(token.tokenString, tenantName, assignedUserId);

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId,
        actionPerformed: isInvestigationTask
          ? `Assigned task ${taskId} to investigator ${fullname ?? assignedUserId} and updated case ${existingTask.case_id} to ASSIGNED`
          : `Assigned task ${taskId} to user ${fullname ?? assignedUserId}`,
        entityName: 'TaskService',
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
        tenantId: existingTask.tenant_id,
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

  async reassignTask(
    taskId: number,
    actorUserId: string,
    tenantId: string,
    assignedUserId: string,
    note: string,
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
  ): Promise<Task> {
    const { existingTask, existingCase, isInvestigationTask } = await this.fetchTaskAndCase(taskId, tenantId);

    const rbacRole = this.rbacService.getRoleFromUser(user);
    const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: existingCase.status });
    if (!t2.allowed) throw new ForbiddenException(t2.reason);

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
        });
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

    const { token, tenantName } = user;
    const fullname = await this.fetchUserDetails(token.tokenString, tenantName, assignedUserId);

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: assignedUserId,
        actionPerformed: `Task ${taskId} reassigned to investigator ${fullname ?? assignedUserId}`,
        entityName: 'TaskService',
        operation: 'retrieveTask',
        outcome: Outcome.SUCCESS,
        tenantId: existingTask.tenant_id,
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
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
  ): Promise<Task & { unassignmentReason: string }> {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Reason for unassigning task is required');
    }
    const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
    if (!existingTask) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const existingCase = await this.caseRepository.findCaseById(existingTask.case_id, tenantId);
    const rbacRoleUnassign = this.rbacService.getRoleFromUser(user);
    const t2Unassign = this.rbacService.checkTier2({ role: rbacRoleUnassign, endpointKey, currentStatus: existingCase.status });
    if (!t2Unassign.allowed) throw new ForbiddenException(t2Unassign.reason);
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
        await tx.case.update({
          where: { case_id: existingTask.case_id },
          data: { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, case_owner_user_id: null, updated_at: new Date() },
        });
      }

      await this.flowableService.handleCaseStatusChanged({
        caseId: existingTask.case_id,
        newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
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
    const { token, tenantName } = user;
    const fullname = await this.fetchUserDetails(token.tokenString, tenantName, existingTask.assigned_user_id);

    await this.loggingOrchestrationService.logActionsWithHistory(
      {
        userId: actorUserId,
        actionPerformed: `Unassigned task ${taskId} from user ${fullname ?? existingTask.assigned_user_id}.`,
        entityName: 'TaskService',
        operation: 'unassignTask',
        outcome: Outcome.SUCCESS,
        tenantId: existingTask.tenant_id,
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

  async completeTask(
    taskId: number,
    actorUserId: string,
    tenantId: string,
    user: AuthenticatedUser,
    endpointKey: EndpointKey,
  ): Promise<Task> {
    try {
      const txResult = await this.taskRepository.transaction(async (tx) => {
        const existingTask = await this.taskRepository.findTaskById(taskId, tenantId);
        if (!existingTask) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }

        const existingCase = await this.caseRepository.findCaseById(existingTask.case_id, tenantId);
        const rbacRole = this.rbacService.getRoleFromUser(user);
        const t2 = this.rbacService.checkTier2({ role: rbacRole, endpointKey, currentStatus: existingCase.status });
        if (!t2.allowed) throw new ForbiddenException(t2.reason);
        if (rbacRole === 'CMS_COMPLIANCE_OFFICER') {
          if (!existingTask.name || existingTask.name !== TASK_NAMES.SAR_STR_FILING) {
            throw new ForbiddenException('Compliance officers may only complete the SAR/STR task');
          }
        }
        const updatedTask = await this.taskRepository.updateTask(taskId, { status: TaskStatus.STATUS_30_COMPLETED }, tx, true);
        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId: actorUserId,
            actionPerformed: `Completed task ${taskId}`,
            entityName: 'TaskService',
            operation: 'completeTask',
            outcome: Outcome.SUCCESS,
            tenantId: existingTask.tenant_id,
          },
          existingTask.case_id,
          existingTask.tenant_id,
          taskId,
        );

        return { updatedTask };
      });

      await this.executeFlowableOperation(txResult.updatedTask);

      return txResult.updatedTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to complete task ${taskId}: ${errorMessage}`, errorStack, TaskLifecycleService.name);
      throw error;
    }
  }

  private async executeFlowableOperation(task: Task): Promise<void> {
    const flowableOperation = async (): Promise<void> => {
      await this.flowableService.handleTaskCompleted({
        caseId: task.case_id,
        taskName: task.name!,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        completionVariables: {
          sarStrAction: 'complete',
        },
      });
    };

    await this.retry(flowableOperation, 5);
  }

  private async retry(fn: () => Promise<void>, maxRetries: number, attempt = 1): Promise<void> {
    try {
      await fn();
    } catch (error) {
      if (attempt >= maxRetries) {
        this.logger.error(
          'Max retries reached for Flowable operation.',
          error instanceof Error ? error.stack : undefined,
          TaskLifecycleService.name,
        );
        return;
      }
      await setTimeout(1000 * attempt);
      await this.retry(fn, maxRetries, attempt + 1);
    }
  }

  private async fetchUserDetails(token: string, tenantName: string, userId?: string): Promise<string | undefined> {
    try {
      this.logger.log(`Fetching user details for userId: ${userId} in tenant: ${tenantName}`, TaskLifecycleService.name);
      if (userId) {
        const investigatorList = await this.userService.getUsersByRole(token, 'CMS_INVESTIGATOR', tenantName);
        this.logger.log(`Fetched ${investigatorList.length} investigators`, TaskLifecycleService.name);
        const investigator = investigatorList.find((i) => i.id === userId);

        if (investigator) {
          return `${investigator.firstName} ${investigator.lastName}`;
        } else {
          const supervisorList = await this.userService.getUsersByRole(token, 'CMS_SUPERVISOR', tenantName);
          this.logger.log(`Fetched ${supervisorList.length} supervisors`, TaskLifecycleService.name);
          const isSupervisor = supervisorList.find((s) => s.id === userId);
          if (isSupervisor) {
            return `${isSupervisor.firstName} ${isSupervisor.lastName}`;
          }
        }
      } else {
        return undefined;
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      this.logger.warn(`Failed to fetch user details: ${errorMessage}`, errorStack, TaskLifecycleService.name);
    }
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
