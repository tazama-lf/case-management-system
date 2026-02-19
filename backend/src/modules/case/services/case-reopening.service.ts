import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { NotificationService } from 'src/modules/notification/notification.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { TaskService } from 'src/modules/task/task.service';
import { CaseStatus, TaskStatus } from '@prisma/client-cms';
import { CANDIDATE_GROUPS, TASK_NAMES, VALIDATION_LENGTHS, REOPENABLE_CASE_STATUSES } from '../../../constants/case.constants';
import { ConflictException } from '@nestjs/common/exceptions/conflict.exception';
import { determineOriginalClosedStatus, isInvestigatorRole } from '../../../utils/helperFunction';
import { PrismaService } from 'prisma/prisma.service';
import { CaseQueryService } from './case-query.service';
import { Outcome } from '../../../utils/types/outcome';
import { FlowableService } from '../../flowable/flowable.service';
import { CommentRepository } from 'src/modules/repository/comment.repository';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
@Injectable()
export class CaseReopeningService {
  constructor(
    private readonly caseRepository: CaseRepository,
    private readonly commentRepository: CommentRepository,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
    private readonly prismaService: PrismaService,
    private readonly taskService: TaskService,
    private readonly logger: LoggerService,
    private readonly caseQueryService: CaseQueryService,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  private determineOriginalClosedStatus(caseData: any): CaseStatus {
    return determineOriginalClosedStatus(caseData);
  }

  async reopenCase(caseId: number, reason: string, userId: string, tenantId: string, role: string) {
    try {
      this.logger.log(`Investigator ${userId} reopening case ${caseId}`, CaseReopeningService.name);

      const existingCase = await this.caseQueryService.retrieveCase(caseId);

      if (!REOPENABLE_CASE_STATUSES.includes(existingCase.status)) {
        throw new BadRequestException(`Case ${caseId} is not in a valid closed state for reopening`);
      }

      if (existingCase.parent_id) {
        const parentCase = await this.caseQueryService.retrieveCase(existingCase.parent_id);
        if (!REOPENABLE_CASE_STATUSES.includes(parentCase.status)) {
          throw new BadRequestException(
            `SubCase ${caseId} cannot be reopened as the parent Case ${parentCase.case_id} is not in a valid closed state for reopening`,
          );
        }
      }

      if (!reason || reason.trim().length < VALIDATION_LENGTHS.MIN_REOPENING_REASON) {
        throw new BadRequestException(
          `Reason for reopening case is required and must be at least ${VALIDATION_LENGTHS.MIN_REOPENING_REASON} characters`,
        );
      }

      const isSupervisor = role === 'CMS_SUPERVISOR';

      if (isSupervisor) {
        const result = await this.prismaService.$transaction(async (tx) => {
          const updatedCase = await tx.case.update({
            where: { case_id: caseId },
            data: {
              status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
              updated_at: new Date(),
            },
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
              (subCase?.status === CaseStatus.STATUS_82_CLOSED_CONFIRMED ||
                subCase?.status === CaseStatus.STATUS_81_CLOSED_REFUTED ||
                subCase?.status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE)
            ) {
              await tx.case.update({
                where: { case_id: updatedCase.parent_id },
                data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
              });
            }
          }

          return { case: updatedCase };
        });

        // Create new investigation task for supervisor
        const investigationTask = await this.taskService.createTask(
          {
            caseId,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: TASK_NAMES.INVESTIGATE_CASE,
            description: `Case reopened by supervisor for additional investigation. Reason: ${reason}`,
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          },
          userId,
        );

        this.flowableService.handleCaseStatusChanged({
          caseId,
          newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          reason: `Case reopening requested: ${reason}`,
        });

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'reopenCase',
            entityName: CaseReopeningService.name,
            actionPerformed: `Reopened case ${caseId} and created investigation task ${investigationTask.task_id}. Reason: ${reason}`,
            outcome: Outcome.SUCCESS,
          },
          caseId,
        );

        return {
          success: true,
          message: 'Case reopened successfully',
          case: result.case,
          investigation_task: {
            task_id: investigationTask.task_id,
            name: investigationTask.name,
            status: investigationTask.status,
            assigned_to: userId,
          },
        };
      }

      const result = await this.prismaService.$transaction(async (tx) => {
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
        );

        await this.commentRepository.createComment(
          userId,
          {
            caseId,
            note: JSON.stringify({
              requestedBy: userId,
              requesterRole: role || 'UNKNOWN',
              reason,
              previousStatus: existingCase.status,
              requestedAt: new Date().toISOString(),
            }),
            tenantId,
          },
          tx,
        );

        return { case: updatedCase, approvalTask };
      });

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        reason: `Case reopening requested: ${reason}`,
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'reopenCase',
          entityName: CaseReopeningService.name,
          actionPerformed: `Reopened case ${caseId} pending supervisor approval. Reason: ${reason}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
      );

      return {
        success: true,
        message: 'Case reopened and pending supervisor approval',
        case: result.case,
        approvalTask: result.approvalTask,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to reopen case ${caseId}: ${errorMessage}`, errorStack, CaseReopeningService.name);

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'reopenCase',
        entityName: CaseReopeningService.name,
        actionPerformed: `Failed to reopen case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async approveCaseReopening(caseId: number, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} approving case reopening for ${caseId}`, CaseReopeningService.name);

      const caseData = await this.validateReopeningPreconditions(caseId);

      // Step 2: Find the reopening approval task
      const reopeningTask = await this.caseRepository.findUnassignedTaskForReopening(caseId);

      if (!reopeningTask) {
        throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
      }

      let reopeningMetadata: any = {};
      let requesterId: string | null = null;
      let requesterRole: string | null = null;

      if (reopeningTask.comments.length > 0) {
        try {
          const comment = reopeningTask.comments[0];
          const metadata = JSON.parse(comment.note);
          reopeningMetadata = metadata;
          requesterId = metadata.requestedBy;
          requesterRole = metadata.requesterRole;
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          const errorStack = parseError instanceof Error ? parseError.stack : undefined;
          this.logger.warn(`Failed to parse reopening metadata: ${errorMessage}`, errorStack, CaseReopeningService.name);
        }
      }

      let newCaseStatus: CaseStatus;
      let newTaskStatus: TaskStatus;
      let assignedUserId: string | undefined;
      let candidateGroup: string;

      const isAnalystOrInvestigator = isInvestigatorRole(requesterRole);

      if (isAnalystOrInvestigator && requesterId) {
        newCaseStatus = CaseStatus.STATUS_10_ASSIGNED;
        newTaskStatus = TaskStatus.STATUS_10_ASSIGNED;
        assignedUserId = requesterId;
        candidateGroup = CANDIDATE_GROUPS.INVESTIGATIONS;

        this.logger.log(`Reopening approved - assigning to original requester ${requesterId}`, CaseReopeningService.name);
      } else {
        newCaseStatus = CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
        newTaskStatus = TaskStatus.STATUS_01_UNASSIGNED;
        assignedUserId = undefined;
        candidateGroup = CANDIDATE_GROUPS.INVESTIGATIONS;

        this.logger.log(
          `Reopening approved - assigning to investigations queue (requester role: ${requesterRole || 'unknown'})`,
          CaseReopeningService.name,
        );
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case status
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: newCaseStatus,
            case_owner_user_id: assignedUserId || null,
            updated_at: new Date(),
          },
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
            (subCase?.status === CaseStatus.STATUS_82_CLOSED_CONFIRMED ||
              subCase?.status === CaseStatus.STATUS_81_CLOSED_REFUTED ||
              subCase?.status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE)
          ) {
            await tx.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
            });
          }
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
            note: `Case reopening approved by supervisor. Previous status: ${caseData.status}. Reason: ${reopeningMetadata.reason || 'Not specified'}`,
            tenantId,
          },
          tx,
        );

        return { updatedCase, completedTask };
      });

      const investigationTask = await this.taskService.createTask(
        {
          caseId,
          status: newTaskStatus,
          assignedUserId,
          name: TASK_NAMES.INVESTIGATE_CASE,
          description: `Case reopened for additional investigation. ${reopeningMetadata.reason || ''}`,
          candidateGroup,
        },
        supervisorId,
      );

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: newCaseStatus,
        reason: 'Case reopening approved',
      });

      if (assignedUserId) {
        try {
          await this.notificationService.sendNotification({
            userId: assignedUserId,
            type: 'CASE_REOPENED_ASSIGNED',
            message: `Case ${caseId} has been reopened and assigned to you`,
            metadata: {
              caseId,
              taskId: investigationTask.task_id,
              approvedBy: supervisorId,
              reason: reopeningMetadata.reason,
              taskTitle: investigationTask.name,
            },
          });
        } catch (notificationError) {
          const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
          const errorStack = notificationError instanceof Error ? notificationError.stack : undefined;
          this.logger.warn(`Failed to send analyst notification: ${errorMessage}`, errorStack, CaseReopeningService.name);
        }
      } else {
        try {
          await this.notificationService.sendGroupNotification({
            candidateGroup,
            type: 'CASE_REOPENED_AVAILABLE',
            message: `Case ${caseId} has been reopened and is available in the work queue`,
            metadata: {
              caseId,
              taskId: investigationTask.task_id,
              approvedBy: supervisorId,
            },
          });
        } catch (notificationError) {
          const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
          const errorStack = notificationError instanceof Error ? notificationError.stack : undefined;
          this.logger.warn(`Failed to send group notification: ${errorMessage}`, errorStack, CaseReopeningService.name);
        }
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'approveCaseReopening',
          entityName: CaseReopeningService.name,
          actionPerformed: `Case ${caseId} reopening approved. New investigation task ${investigationTask.task_id} created${assignedUserId ? ` and assigned to ${assignedUserId}` : ' in investigations queue'}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
      );

      this.logger.log(`Case ${caseId} reopening approved. Status: ${newCaseStatus}`, CaseReopeningService.name);

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
          task_id: investigationTask.task_id,
          name: investigationTask.name,
          status: investigationTask.status,
          assigned_to: assignedUserId || candidateGroup,
          candidateGroup,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to approve case reopening: ${errorMessage}`, errorStack, CaseReopeningService.name);

      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'approveCaseReopening',
        entityName: CaseReopeningService.name,
        actionPerformed: `Failed to approve case reopening for ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async rejectCaseReopening(caseId: number, rejectionReason: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case reopening for ${caseId}`, CaseReopeningService.name);

      if (!rejectionReason || rejectionReason.trim().length < VALIDATION_LENGTHS.MIN_REJECTION_REASON) {
        const errorMsg = `Rejection reason must be at least ${VALIDATION_LENGTHS.MIN_REJECTION_REASON} characters`;
        await this.loggingOrchestrationService.logActions({
          userId: supervisorId,
          operation: 'rejectCaseReopening',
          entityName: CaseReopeningService.name,
          actionPerformed: `Failed to reject case reopening for ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException(errorMsg);
      }

      const caseData = await this.validateReopeningPreconditions(caseId);

      const reopeningTask = await this.caseRepository.findReopeningTaskForRejection(caseId);

      if (!reopeningTask) {
        throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
      }

      let requesterId: string | null = null;
      if (reopeningTask.comments.length > 0) {
        try {
          const metadata = JSON.parse(reopeningTask.comments[0].note);
          requesterId = metadata.requestedBy;
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          const errorStack = parseError instanceof Error ? parseError.stack : undefined;
          this.logger.warn(`Failed to parse reopening metadata: ${errorMessage}`, errorStack, CaseReopeningService.name);
        }
      }

      const originalClosedStatus = this.determineOriginalClosedStatus(caseData);

      const result = await this.prismaService.$transaction(async (tx) => {
        // Restore case to original closed status
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

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: originalClosedStatus,
        reason: `Case reopening rejected: ${rejectionReason}`,
      });

      if (requesterId) {
        try {
          await this.notificationService.sendNotification({
            userId: requesterId,
            type: 'CASE_REOPENING_REJECTED',
            message: `Your case reopening request for case ${caseId} was rejected`,
            metadata: {
              caseId,
              rejectionReason,
              rejectedBy: supervisorId,
              restoredStatus: originalClosedStatus,
              taskTitle: reopeningTask.name,
            },
          });
        } catch (notificationError) {
          const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
          const errorStack = notificationError instanceof Error ? notificationError.stack : undefined;
          this.logger.warn(`Failed to send rejection notification: ${errorMessage}`, errorStack, CaseReopeningService.name);
        }
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'rejectCaseReopening',
          entityName: CaseReopeningService.name,
          actionPerformed: `Case ${caseId} reopening rejected. Case restored to ${originalClosedStatus}. Reason: ${rejectionReason}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
      );

      this.logger.log(`Case ${caseId} reopening rejected. Restored to ${originalClosedStatus}`, CaseReopeningService.name);

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
      this.logger.error(`Failed to reject case reopening: ${errorMessage}`, errorStack, CaseReopeningService.name);

      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'rejectCaseReopening',
        entityName: CaseReopeningService.name,
        actionPerformed: `Failed to reject case reopening for ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  private async validateReopeningPreconditions(caseId: number): Promise<any> {
    const caseData = await this.caseRepository.findCaseForReopening(caseId);

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
}
