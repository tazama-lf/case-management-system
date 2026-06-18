import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { NotificationService } from 'src/modules/notification/notification.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TaskService } from 'src/modules/task/task.service';
import { Case, CaseCreationType, CaseStatus, Task, TaskStatus } from '@prisma/client-cms';
import { CANDIDATE_GROUPS, TASK_NAMES, VALIDATION_LENGTHS, REOPENABLE_CASE_STATUSES } from '../../../constants/case.constants';
import { ConflictException } from '@nestjs/common/exceptions/conflict.exception';
import { Outcome } from '../../../utils/types/outcome';
import { FlowableService } from '../../flowable/flowable.service';
import { CommentRepository } from 'src/modules/repository/comment.repository';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { setTimeout } from 'node:timers/promises';

@Injectable()
export class CaseReopeningService {
  constructor(
    private readonly caseRepository: CaseRepository,
    private readonly commentRepository: CommentRepository,
    private readonly notificationService: NotificationService,
    private readonly taskService: TaskService,
    private readonly loggerService: LoggerService,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async reopenCase(
    caseId: number,
    reason: string,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{
    success: boolean;
    message: string;
    case: Case;
    investigation_task?: {
      task_id: number;
      name: string | null;
      status: TaskStatus;
      assigned_to: string;
    };
    approvalTask?: Task;
  }> {
    try {
      this.loggerService.log(`Investigator ${userId} reopening case ${caseId}`, CaseReopeningService.name);
      if (!reason || reason.trim().length < VALIDATION_LENGTHS.MIN_REOPENING_REASON) {
        throw new BadRequestException(
          `Reason for reopening case is required and must be at least ${VALIDATION_LENGTHS.MIN_REOPENING_REASON} characters`,
        );
      }

      if (role === 'CMS_SUPERVISOR') {
        const txResult = await this.caseRepository.transaction(async (tx) => {
          const existingCaseForUpdate = await this.caseRepository.findCaseById(caseId, tenantId, tx);
          if (!REOPENABLE_CASE_STATUSES.includes(existingCaseForUpdate.status)) {
            throw new BadRequestException(`Case ${caseId} is not in a valid closed state for reopening`);
          }

          const updatedCase = await tx.case.update({
            where: { case_id: caseId },
            data: {
              status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
              updated_at: new Date(),
            },
          });

          if (updatedCase.parent_id) {
            await tx.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
            });
          }

          const investigationTask = await this.taskService.createTask(
            {
              caseId,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: TASK_NAMES.INVESTIGATE_CASE,
              description: `Case reopened by supervisor for additional investigation. Reason: ${reason}`,
              candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            },
            userId,
            tenantId,
            tx,
          );
          return { case: updatedCase, investigationTask };
        });

        this.executeFlowableOperations(caseId, tenantId, role);

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'reopenCase',
            entityName: CaseReopeningService.name,
            actionPerformed: `Reopened case ${caseId} and created investigation task ${txResult.investigationTask.task_id}. Reason: ${reason}`,
            outcome: Outcome.SUCCESS,
            tenantId: txResult.case.tenant_id,
          },
          caseId,
          txResult.case.tenant_id,
        );

        return {
          success: true,
          message: 'Case reopened successfully',
          case: txResult.case,
          investigation_task: {
            task_id: txResult.investigationTask.task_id,
            name: txResult.investigationTask.name,
            status: txResult.investigationTask.status,
            assigned_to: userId,
          },
        };
      } else {
        const txResult = await this.caseRepository.transaction(async (tx) => {
          const existingCaseForUpdate = await this.caseRepository.findCaseById(caseId, tenantId, tx);
          if (!REOPENABLE_CASE_STATUSES.includes(existingCaseForUpdate.status)) {
            throw new BadRequestException(`Case ${caseId} is not in a valid closed state for reopening`);
          }

          const updatedCase = await tx.case.update({
            where: { case_id: caseId },
            data: {
              status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
              updated_at: new Date(),
            },
          });

          const approvalTask = await this.taskService.createTask(
            {
              caseId,
              name: TASK_NAMES.APPROVE_CASE_REOPENING,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              description: `Case reopening approval required. Reason: ${reason}`,
              candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
            },
            userId,
            tenantId,
            tx,
          );

          await this.commentRepository.createComment(
            userId,
            {
              caseId,
              note: `Case reopen request initiated by investigator.\nReason: ${reason || 'Not specified'}, Current Status: ${existingCaseForUpdate.status}`,
              tenantId,
            },
            tx,
          );

          return { case: updatedCase, approvalTask };
        });

        this.executeFlowableOperations(caseId, tenantId, role);

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'reopenCase',
            entityName: CaseReopeningService.name,
            actionPerformed: `Reopened case ${caseId} pending supervisor approval. Reason: ${reason}`,
            outcome: Outcome.SUCCESS,
            tenantId: txResult.case.tenant_id,
          },
          caseId,
          txResult.case.tenant_id,
        );

        return {
          success: true,
          message: 'Case reopened and pending supervisor approval',
          case: txResult.case,
          approvalTask: txResult.approvalTask,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.loggerService.error(`Failed to reopen case ${caseId}: ${errorMessage}`, errorStack, CaseReopeningService.name);
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'reopenCase',
        entityName: CaseReopeningService.name,
        actionPerformed: `Failed to reopen case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
        tenantId,
      });

      throw error;
    }
  }

  async approveCaseReopening(
    caseId: number,
    supervisorId: string,
    tenantId: string,
  ): Promise<{
    success: boolean;
    message: string;
    case: {
      case_id: number;
      status: CaseStatus;
      case_owner_user_id: string | null;
      updated_at: Date;
    };
    completed_approval_task: {
      task_id: number;
      status: TaskStatus;
    };
    investigation_task: {
      task_id: number;
      name: string | null;
      status: TaskStatus;
      assigned_to: string;
      candidateGroup: string;
    };
  }> {
    try {
      this.loggerService.log(`Supervisor ${supervisorId} approving case reopening for ${caseId}`, CaseReopeningService.name);
      const newCaseStatus: CaseStatus = CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
      const newTaskStatus: TaskStatus = TaskStatus.STATUS_01_UNASSIGNED;
      let assignedUserId: string | undefined;
      const candidateGroup: string = CANDIDATE_GROUPS.INVESTIGATIONS;
      const caseData = await this.validateReopeningPreconditions(caseId, tenantId);

      const result = await this.caseRepository.transaction(async (tx) => {
        const reopeningTask = await this.caseRepository.findUnassignedTaskForReopening(caseId, tenantId, tx);
        if (!reopeningTask) {
          throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
        }

        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: newCaseStatus,
            updated_at: new Date(),
          },
        });

        if (updatedCase.parent_id) {
          await tx.case.update({
            where: { case_id: updatedCase.parent_id },
            data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
          });
        }

        const completedTask = await tx.task.update({
          where: { task_id: reopeningTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await this.commentRepository.createComment(
          supervisorId,
          {
            caseId,
            note: `Case reopening approved by supervisor. Previous status: ${caseData.status}.`,
            tenantId,
          },
          tx,
        );

        const investigationTask = await this.taskService.createTask(
          {
            caseId,
            status: newTaskStatus,
            assignedUserId,
            name: TASK_NAMES.INVESTIGATE_CASE,
            description: 'Case reopened for additional investigation.',
            candidateGroup,
          },
          supervisorId,
          tenantId,
        );

        return { updatedCase, completedTask, investigationTask };
      });

      await this.executeFlowableOperations(caseId, tenantId, 'CMS_SUPERVISOR', newCaseStatus, true);

      try {
        await this.notificationService.sendGroupNotification({
          candidateGroup,
          type: 'CASE_REOPENED_AVAILABLE',
          message: `Case ${caseId} has been reopened and is available in the work queue`,
          metadata: {
            caseId,
            taskId: result.investigationTask.task_id,
            approvedBy: supervisorId,
          },
        });
      } catch (notificationError) {
        const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
        const errorStack = notificationError instanceof Error ? notificationError.stack : undefined;
        this.loggerService.warn(`Failed to send group notification: ${errorMessage}`, errorStack, CaseReopeningService.name);
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'approveCaseReopening',
          entityName: CaseReopeningService.name,
          actionPerformed: `Case ${caseId} reopening approved.`,
          outcome: Outcome.SUCCESS,
          tenantId: caseData.tenant_id,
        },
        caseId,
        caseData.tenant_id,
      );

      this.loggerService.log('End - approveCaseReopening', CaseReopeningService.name);
      return {
        success: true,
        message: 'Case reopening approved',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          case_owner_user_id: result.updatedCase.case_owner_user_id,
          updated_at: result.updatedCase.updated_at,
        },
        completed_approval_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        investigation_task: {
          task_id: result.investigationTask.task_id,
          name: result.investigationTask.name,
          status: result.investigationTask.status,
          assigned_to: assignedUserId ?? candidateGroup,
          candidateGroup,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to approve case reopening: ${errorMessage}`, errorStack, CaseReopeningService.name);

      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'approveCaseReopening',
        entityName: CaseReopeningService.name,
        actionPerformed: `Failed to approve case reopening for ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
        tenantId,
      });

      throw error;
    }
  }

  async rejectCaseReopening(
    caseId: number,
    rejectionReason: string,
    supervisorId: string,
    tenantId: string,
  ): Promise<{
    success: boolean;
    message: string;
    case: { case_id: number; status: CaseStatus; updated_at: Date };
    completed_task: { task_id: number; status: TaskStatus };
    rejection_reason: string;
  }> {
    try {
      this.loggerService.log(`Supervisor ${supervisorId} rejecting case reopening for ${caseId}`, CaseReopeningService.name);
      if (!rejectionReason || rejectionReason.trim().length < VALIDATION_LENGTHS.MIN_REJECTION_REASON) {
        throw new BadRequestException(`Rejection reason must be at least ${VALIDATION_LENGTHS.MIN_REJECTION_REASON} characters`);
      }
      const caseData = await this.validateReopeningPreconditions(caseId, tenantId);

      const reopeningTask = await this.caseRepository.findReopeningTaskForRejection(caseId, tenantId);
      if (!reopeningTask) {
        throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
      }

      const originalClosedStatus = caseData.final_outcome ?? CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE;

      const result = await this.caseRepository.transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: originalClosedStatus,
            updated_at: new Date(),
          },
        });

        const completedTask = await tx.task.update({
          where: { task_id: reopeningTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await this.commentRepository.createComment(
          supervisorId,
          {
            caseId,
            note: `Case reopening rejected by supervisor.\n\nReason: ${rejectionReason}\n\nCase restored to status: ${originalClosedStatus}`,
            tenantId,
          },
          tx,
        );

        return { updatedCase, completedTask };
      });

      await this.flowableService.handleTaskCompleted({
        caseId,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        taskName: 'Approve Case Reopening',
        completionVariables: {
          reopenApprovalDecision: 'reject',
        },
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'rejectCaseReopening',
          entityName: CaseReopeningService.name,
          actionPerformed: `Case ${caseId} reopening rejected. Case restored to ${originalClosedStatus}. Reason: ${rejectionReason}`,
          outcome: Outcome.SUCCESS,
          tenantId: caseData.tenant_id,
        },
        caseId,
        caseData.tenant_id,
      );

      this.loggerService.log(`Case ${caseId} reopening rejected. Restored to ${originalClosedStatus}`, CaseReopeningService.name);

      return {
        success: true,
        message: 'Case reopening rejected',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        rejection_reason: rejectionReason,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to reject case reopening: ${errorMessage}`, errorStack, CaseReopeningService.name);

      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'rejectCaseReopening',
        entityName: CaseReopeningService.name,
        actionPerformed: `Failed to reject case reopening for ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
        tenantId,
      });

      throw error;
    }
  }

  private async validateReopeningPreconditions(caseId: number, tenantId: string): Promise<any> {
    const caseData = await this.caseRepository.findCaseForReopening(caseId, tenantId);

    if (!caseData) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseData.status !== CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending reopening approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        caseId,
      });
    }

    const reopeningTask = caseData.tasks.find((t) => t.name === 'Approve Case Reopening' && t.status === TaskStatus.STATUS_01_UNASSIGNED);

    if (!reopeningTask) {
      throw new NotFoundException(`"Approve Case Reopening" task not found or not in correct state for case ${caseId}`);
    }

    return caseData;
  }

  private readonly executeFlowableOperations = async (
    caseId: number,
    tenantId: string,
    role: string,
    newCaseStatus?: string,
    approvalDecision?: boolean,
  ): Promise<void> => {
    const flowableOperations = async (): Promise<void> => {
      if (role === 'CMS_SUPERVISOR') {
        if (approvalDecision === undefined) {
          await this.flowableService.handleCaseCreated({
            caseId,
            tenantId,
            caseStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            creationType: CaseCreationType.MANUAL,
            creatorRole: 'SUPERVISOR',
            isReopened: true,
            isFraudNAML: false,
          });
        } else if (approvalDecision) {
          await this.flowableService.handleTaskCompleted({
            caseId,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            taskName: 'Approve Case Reopening',
            completionVariables: {
              reopenApprovalDecision: 'approve',
            },
          });

          await this.flowableService.handleCaseStatusChanged({
            caseId,
            newStatus: newCaseStatus!,
          });
        } else {
          await this.flowableService.handleTaskCompleted({
            caseId,
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            taskName: 'Approve Case Reopening',
            completionVariables: {
              reopenApprovalDecision: 'reject',
            },
          });
        }
      } else {
        await this.flowableService.handleCaseCreated({
          caseId,
          tenantId,
          caseStatus: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
          creationType: CaseCreationType.MANUAL,
          creatorRole: 'INVESTIGATOR',
          isReopened: true,
          isFraudNAML: false,
        });
      }
    };

    await this.retryFlowableOperations(flowableOperations, 5);
  };

  private readonly retryFlowableOperations = async (fn: () => Promise<void>, maxRetries: number, attempt = 1): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      if (attempt > maxRetries) throw error;
      await setTimeout(1000 * attempt);
      await this.retryFlowableOperations(fn, maxRetries, attempt + 1);
    }
  };
}
