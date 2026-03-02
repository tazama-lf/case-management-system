import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../../utils/types/outcome';
import { CaseStatus, CaseType, Comment, Priority, Task, TaskStatus } from '@prisma/client-cms';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import {
  TASK_NAMES,
  CANDIDATE_GROUPS,
  CASE_CLOSURE_OUTCOMES,
  VALIDATION_LENGTHS,
  CLOSED_CASE_STATUSES,
} from '../../../constants/case.constants';
import { CloseCaseDto } from '../dto';
import { NotificationService } from 'src/modules/notification/notification.service';
// import { validateClosureData } from 'src/utils/helperFunction';
import { TaskValidationUtil } from 'src/modules/shared/utils/task-validation.util';
import { FlowableService } from 'src/modules/flowable/flowable.service';
import { CreateCommentDto } from 'src/modules/comment/dto/create-comment.dto';
import { CommentService } from 'src/modules/comment/comment.service';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { CommentRepository } from 'src/modules/repository/comment.repository';

@Injectable()
export class CaseClosureApprovalService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly commentRepository: CommentRepository,
    private readonly taskService: TaskService,
    private readonly notificationService: NotificationService,
    private readonly flowableService: FlowableService,
    private readonly commentService: CommentService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly taskValidationUtil: TaskValidationUtil,
  ) {}

  private async createSARFilingTask(caseId: number, tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Start - Creating SAR_STR_FILING task for case ${caseId}`, CaseClosureApprovalService.name);

    try {
      const createSARFilingTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: TASK_NAMES.SAR_STR_FILING,
          description:
            'Upload the official SAR/STR submission acknowledgment from FIU. Include submission date, reference number, and submission channel.',
          candidateGroup: CANDIDATE_GROUPS.COMPLIANCE_OFFICER,
        },
        userId,
        tenantId,
      );

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'createSARTask',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Auto-generated SAR_STR_FILING task ${createSARFilingTask.task_id} for confirmed case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `End - Successfully created SAR_STR_FILING task ${createSARFilingTask.task_id} for case ${caseId}`,
        CaseClosureApprovalService.name,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to create SAR_STR_FILING task for case ${caseId}: ${errorMessage}`,
        errorStack,
        CaseClosureApprovalService.name,
      );

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'createSARTask',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to create SAR_STR_FILING task for case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });
    }
  }

  async closeCase(
    caseId: number,
    dto: CloseCaseDto,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ message: string; closed_case: { case_id: number; status: string; updated_at: Date }; supervisor_closure?: boolean }> {
    try {
      const caseData = await this.caseRepository.findCaseWithPermissionCheck(caseId, tenantId, userId);

      if (!caseData) {
        throw new NotFoundException(`Case ${caseId} not found or you don't have permission to close it`);
      }
      if (caseData.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
        throw new ConflictException({
          message: 'Case is not in a closeable state',
          currentStatus: caseData.status,
          requiredStatus: CaseStatus.STATUS_20_IN_PROGRESS,
          caseId,
        });
      }

      // Check case type for FRAUD_AND_AML parallel investigation logic
      const isFraudAndAmlCase = caseData.case_type === 'FRAUD_AND_AML';
      let primaryTask: Task | null = null;

      if (isFraudAndAmlCase) {
        // Validate both child cases exist for FRAUD_AND_AML cases
        if (role === 'CMS_SUPERVISOR') {
          const subCase = await this.prismaService.case.findMany({
            where: {
              parent_id: caseId,
              tenant_id: caseData.tenant_id,
            },
          });

          if (subCase && subCase.length > 0) {
            const areSubCasesClosable = subCase.every((c) => CLOSED_CASE_STATUSES.includes(c.status));
            this.logger.log(`areSubCasesClosable: ${areSubCasesClosable}`);
            if (!areSubCasesClosable) {
              throw new ConflictException({
                message: 'Either of the Sub Case is not in closable state for parent case closure',
                caseId,
              });
            }
          } else {
            throw new BadRequestException({
              message: 'Sub Cases does not exist for this FRAUD_AND_AML Case',
              caseId,
            });
          }
        } else {
          throw new BadRequestException({
            message: 'Only a Supervisor can close FRAUD_AND_AML Case',
            caseId,
          });
        }
      } else {
        // Single investigation case
        const investigationTask =
          caseData.tasks
            .filter(
              (task) =>
                task.name === TASK_NAMES.INVESTIGATE_CASE &&
                (task.status === TaskStatus.STATUS_20_IN_PROGRESS || task.status === TaskStatus.STATUS_30_COMPLETED),
            )
            .sort((a, b) => {
              const aTime = new Date(a.created_at || 0).getTime();
              const bTime = new Date(b.created_at || 0).getTime();
              return bTime - aTime;
            })[0] || null;

        if (!investigationTask) {
          throw new BadRequestException({
            message: 'Investigation task not found for this case',
            caseId,
            missingTask: TASK_NAMES.INVESTIGATE_CASE,
            availableTasks: caseData.tasks.map((t) => ({ name: t.name, status: t.status })),
          });
        }

        this.logger.log(
          `Found investigation task userId ${investigationTask.assigned_user_id} and userId ${userId}`,
          CaseClosureApprovalService.name,
        );

        if (investigationTask.assigned_user_id !== userId) {
          throw new BadRequestException({
            message: 'Investigation task is not assigned to you',
            caseId,
            taskId: investigationTask.task_id,
            assignedTo: investigationTask.assigned_user_id,
          });
        }

        if (investigationTask.status !== TaskStatus.STATUS_20_IN_PROGRESS && investigationTask.status !== TaskStatus.STATUS_30_COMPLETED) {
          throw new ConflictException({
            message: 'Investigation task must be in progress or completed to close case',
            currentStatus: investigationTask.status,
            requiredStatuses: [TaskStatus.STATUS_20_IN_PROGRESS, TaskStatus.STATUS_30_COMPLETED],
            taskId: investigationTask.task_id,
          });
        }
        primaryTask = investigationTask;
      }

      // SUPERVISOR DIRECT CLOSURE PATH
      if (role === 'CMS_SUPERVISOR') {
        const finalStatus = dto.recommendedOutcome as CaseStatus;

        const result = await this.caseRepository.updateCaseStatusAndCompleteTask(
          caseId,
          finalStatus,
          primaryTask?.task_id,
          userId,
          dto.recommendedOutcome,
          dto.finalNotes
            ? {
                note: `Supervisor Direct Closure:\n${dto.recommendedOutcome}${isFraudAndAmlCase ? ' (Both Fraud and AML investigations completed)' : ''}\n${dto.finalNotes}\nFinal Outcome: ${dto.recommendedOutcome}`,
                tenantId,
              }
            : undefined,
        );
        if (!isFraudAndAmlCase) {
          await this.flowableService.handleTaskCompleted({
            caseId,
            taskName: 'Investigate Case',
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              investigationAction: 'complete',
              finalOutcome: dto.recommendedOutcome,
              investigationNotes: dto.finalNotes,
              userRole: role,
            },
          });
        }

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'closeCase',
            entityName: CaseClosureApprovalService.name,
            actionPerformed: `Supervisor closed case ${caseId} with outcome: ${dto.recommendedOutcome}`,
            outcome: Outcome.SUCCESS,
          },
          caseId,
          caseData.tenant_id,
        );

        // Auto-generate SAR_STR_FILING task if case is confirmed
        if (finalStatus === CaseStatus.STATUS_82_CLOSED_CONFIRMED) {
          try {
            await this.createSARFilingTask(caseId, tenantId, userId);
            this.logger.log(`Auto-generated SAR_STR_FILING task for confirmed case ${caseId}`, CaseClosureApprovalService.name);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(
              `Failed to create SAR_STR_FILING task for case ${caseId}: ${errorMessage}`,
              errorStack,
              CaseClosureApprovalService.name,
            );
            await this.loggingOrchestrationService.logActions({
              userId,
              operation: 'closeCase',
              entityName: CaseClosureApprovalService.name,
              actionPerformed: `Supervisor closed case ${caseId} with outcome: ${dto.recommendedOutcome}`,
              outcome: Outcome.SUCCESS,
            });
          }
        }

        return {
          message: 'Case closed successfully by supervisor',
          closed_case: {
            case_id: result.updatedCase.case_id,
            status: result.updatedCase.status,
            updated_at: result.updatedCase.updated_at,
          },
          supervisor_closure: true,
        };
      }

      // INVESTIGATOR CLOSURE PATH - REQUIRES APPROVAL
      const approvalTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: TASK_NAMES.APPROVE_CASE_CLOSURE,
          description: `Review and approve case closure for case ${caseId}`,
          candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
        },
        userId,
        tenantId,
      );

      const result = await this.caseRepository.updateCaseStatusAndCompleteTask(
        caseId,
        CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        primaryTask?.task_id,
        userId,
        dto.recommendedOutcome,
        dto.finalNotes
          ? {
              note: `Final Investigation Summary${isFraudAndAmlCase ? ' (Both Fraud and AML investigations completed)' : ''}:\n${dto.finalNotes}\n\nRecommended Outcome: ${dto.recommendedOutcome}`,
              taskId: approvalTask.task_id,
              tenantId,
            }
          : undefined,
      );

      if (!isFraudAndAmlCase) {
        await this.flowableService.handleTaskCompleted({
          caseId,
          taskName: 'Investigate Case',
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            investigationAction: 'requestClosure',
            finalOutcome: dto.recommendedOutcome,
            investigationNotes: dto.finalNotes,
            userRole: role,
          },
        });
      }

      await this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Case ${caseId} submitted for approval with outcome: ${dto.recommendedOutcome}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        caseData.tenant_id,
      );

      return {
        message: 'Case closed and submitted for approval',
        closed_case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Case closure failed: ${errorMessage}`, errorStack, CaseClosureApprovalService.name);

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'closeCase',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to close case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'System error occurred during case closure',
        caseId,
        error: errorMessage,
      });
    }
  }

  async approveCaseClosure(
    caseId: number,
    finalOutcome: string,
    comments: string,
    supervisorId: string,
    tenantId: string,
  ): Promise<{
    message: string;
    case: { case_id: number; status: string; updated_at: Date };
    completed_task: { task_id: number; status: string };
  }> {
    try {
      if (!finalOutcome || !CASE_CLOSURE_OUTCOMES.includes(finalOutcome as any)) {
        throw new BadRequestException({
          message: 'Invalid final outcome',
          providedOutcome: finalOutcome,
          validOutcomes: CASE_CLOSURE_OUTCOMES,
        });
      }

      const caseDetails = await this.caseRepository.findCaseForClosureApproval(caseId, tenantId);

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      if (caseDetails.status !== CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL) {
        throw new ConflictException({
          message: 'Case is not pending final approval',
          currentStatus: caseDetails.status,
          requiredStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          caseId,
        });
      }

      const approvalTask = caseDetails.tasks.find(
        (t) => t.name && TASK_NAMES.APPROVE_CASE_CLOSURE_VARIANTS.includes(t.name as any) && t.status === TaskStatus.STATUS_01_UNASSIGNED,
      );

      if (!approvalTask) {
        const errorMsg = 'Approve Case Closure task not found or not in correct state';
        throw new NotFoundException({
          message: `${errorMsg}. The BPMN workflow may not have created the task yet.`,
          availableTasks: caseDetails.tasks.map((t) => ({ name: t.name, status: t.status })),
          caseId,
        });
      }

      const missingInfo = this.validateCaseCompleteness(caseDetails);
      if (missingInfo.length > 0) {
        throw new BadRequestException({
          message: 'Case has incomplete information',
          missingInformation: missingInfo,
          caseId,
        });
      }

      const result = await this.caseRepository.approveClosureTask(
        caseId,
        approvalTask.task_id,
        finalOutcome as CaseStatus,
        supervisorId,
        caseDetails.tenant_id,
        comments,
      );

      this.flowableService.handleTaskCompleted({
        caseId,
        taskName: approvalTask.name ?? 'Approve Case Closure',
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        completionVariables: {
          approvalDecision: 'approve',
          finalOutcome,
          supervisorComments: comments,
        },
      });

      await this.commentService.addComment(
        {
          caseId,
          taskId: approvalTask.task_id,
          note: `Supervisor Approval:\n${comments}\n\nFinal Outcome: ${finalOutcome}`,
          tenantId,
        } as CreateCommentDto,
        supervisorId,
      );

      // Auto-generate SAR/STR Filing task if case is confirmed
      if (finalOutcome === 'STATUS_82_CLOSED_CONFIRMED') {
        try {
          await this.createSARFilingTask(caseId, caseDetails.tenant_id, supervisorId);
          this.logger.log(`Auto-generated SAR_STR_FILING task for confirmed case ${caseId}`, CaseClosureApprovalService.name);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Failed to create SAR_STR_FILING task for case ${caseId}: ${errorMessage}`,
            errorStack,
            CaseClosureApprovalService.name,
          );
        }
      }

      const investigationTask = caseDetails.tasks.find((t) => t.name && t.name === TASK_NAMES.INVESTIGATE_CASE && t.assigned_user_id);

      if (investigationTask?.assigned_user_id) {
        try {
          await this.notificationService.sendNotification({
            userId: investigationTask.assigned_user_id,
            type: 'CASE_CLOSURE_APPROVED',
            message: `Your case closure for case ${caseId} was approved`,
            metadata: {
              caseId,
              finalOutcome,
              approvedBy: supervisorId,
              supervisorComments: comments,
              taskTitle: investigationTask.name,
            },
          });
        } catch (notificationError) {
          const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
          const errorStack = notificationError instanceof Error ? notificationError.stack : undefined;
          this.logger.warn(`Failed to send investigator notification: ${errorMessage}`, errorStack, CaseClosureApprovalService.name);
        }
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Case ${caseId} closure approved with final outcome ${finalOutcome}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        caseDetails.tenant_id,
      );

      this.logger.log(
        `[ApproveCaseClosure] Case ${caseId} closure approved successfully with outcome ${finalOutcome}`,
        CaseClosureApprovalService.name,
      );

      return {
        message: 'Case closure approved',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[ApproveCaseClosure] Case closure approval failed for case ${caseId}: ${errorMessage}`,
        errorStack,
        CaseClosureApprovalService.name,
      );

      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to approve case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'System error occurred during case closure approval',
        caseId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        action: 'approveCaseClosure',
      });
    }
  }

  async rejectCaseClosure(
    caseId: number,
    comments: string,
    supervisorId: string,
    tenantId: string,
  ): Promise<{
    message: string;
    case: { case_id: number; status: string; updated_at: Date };
    completed_approval_task: { task_id: number; status: string };
    investigation_task: { task_id: number; name: string | null; assigned_to: string; status: string };
  }> {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case closure for ${caseId}`, CaseClosureApprovalService.name);

      await this.validateApprovalPreconditions(caseId, tenantId, supervisorId, { autoClaimApprovalTask: true });

      if (!comments || comments.trim().length < VALIDATION_LENGTHS.MIN_REJECTION_REASON) {
        const errorMsg = `Rejection comments must be at least ${VALIDATION_LENGTHS.MIN_REJECTION_REASON} characters`;
        throw new BadRequestException(errorMsg);
      }

      const caseDetails = await this.caseRepository.findCaseWithCompletedInvestigation(caseId, tenantId);

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const originalInvestigationTask = caseDetails.tasks[0];
      const originalInvestigatorId = originalInvestigationTask?.assigned_user_id;

      if (!originalInvestigatorId) {
        throw new BadRequestException('Cannot determine original investigator for case reassignment');
      }

      const result = await this.caseRepository.rejectClosureTask(
        caseId,
        supervisorId,
        originalInvestigatorId,
        comments,
        TASK_NAMES,
        caseDetails.tenant_id,
      );

      // Notify Flowable about case status change FIRST to set the BPMN state
      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_20_IN_PROGRESS,
      });

      // Then complete the approval task in BPMN
      this.flowableService.handleTaskCompleted({
        caseId,
        taskName: 'Approve Case Closure',
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        completionVariables: {
          approvalDecision: 'reject',
          supervisorComments: comments,
          newCaseStatus: CaseStatus.STATUS_20_IN_PROGRESS, // Explicitly set target status
        },
      });

      try {
        await this.notificationService.sendNotification({
          userId: originalInvestigatorId,
          type: 'CASE_CLOSURE_REJECTED',
          message: `Your case closure for case ${caseId} was rejected by supervisor`,
          metadata: {
            caseId,
            taskId: result.newInvestigationTask.task_id,
            supervisorComments: comments,
            rejectedBy: supervisorId,
            taskTitle: originalInvestigationTask.name,
          },
        });
      } catch (notificationError) {
        const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
        const errorStack = notificationError instanceof Error ? notificationError.stack : undefined;
        this.logger.warn(`Failed to send notification to requesting user: ${errorMessage}`, errorStack, CaseClosureApprovalService.name);
      }

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'rejectCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Case ${caseId} closure rejected. New investigation task ${result.newInvestigationTask.task_id} created and assigned to user ${originalInvestigatorId}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        caseDetails.tenant_id,
      );

      this.logger.log(
        `Case ${caseId} closure rejected successfully. New investigation task ${result.newInvestigationTask.task_id} created and assigned to user ${originalInvestigatorId}`,
        CaseClosureApprovalService.name,
      );

      return {
        message: 'Case closure rejected and new investigation task created',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_approval_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        investigation_task: {
          task_id: result.newInvestigationTask.task_id,
          name: result.newInvestigationTask.name,
          assigned_to: originalInvestigatorId,
          status: result.newInvestigationTask.status,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to reject case closure: ${errorMessage}`, errorStack, CaseClosureApprovalService.name);

      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async returnCaseForReview(
    caseId: number,
    comments: string,
    supervisorId: string,
    tenantId: string,
  ): Promise<{ message: string; case: { case_id: number; status: string; updated_at: Date } }> {
    try {
      await this.validateApprovalPreconditions(caseId, tenantId, supervisorId, { autoClaimApprovalTask: true });

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: TASK_NAMES.APPROVE_CASE_CLOSURE_LOWER,
            assigned_user_id: supervisorId,
            status: {
              in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
            },
          },
        });

        if (!approvalTask) {
          throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
        }

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: supervisorId, updated_at: new Date() },
        });

        await this.commentRepository.createComment(
          supervisorId,
          {
            caseId: updatedCase.case_id,
            taskId: approvalTask.task_id,
            note: `Returned for review: ${comments}`,
            tenantId: updatedCase.tenant_id,
          },
          tx,
        );

        return { updatedCase, completedTask };
      });

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_20_IN_PROGRESS,
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'returnCaseForReview',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Case ${caseId} returned for additional review`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        result.updatedCase.tenant_id,
      );

      return {
        message: 'Case returned for additional review',
        case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to return case for review: ${errorMessage}`, errorStack, CaseClosureApprovalService.name);
      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'returnCaseForReview',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to return case ${caseId} for review: ${errorMessage}`,
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }

  private async validateApprovalPreconditions(
    caseId: number,
    tenantId: string,
    supervisorId?: string,
    options: { autoClaimApprovalTask?: boolean } = {},
  ) {
    const caseData = await this.caseRepository.findCaseForReview(caseId, tenantId);

    if (!caseData) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseData.status !== CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending final approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        caseId,
      });
    }

    let approvalValidation = this.taskValidationUtil.validateApprovalTaskForClosure(caseData.tasks, {
      requireClaim: Boolean(supervisorId),
      expectedAssignee: supervisorId,
    });

    const shouldAttemptAutoClaim =
      options.autoClaimApprovalTask &&
      Boolean(supervisorId) &&
      approvalValidation.approvalTask &&
      (approvalValidation.approvalTask.status === TaskStatus.STATUS_01_UNASSIGNED || !approvalValidation.approvalTask.assigned_user_id) &&
      approvalValidation.errors.some((err) => err.toLowerCase().includes('must be claimed'));

    if (shouldAttemptAutoClaim) {
      const approvalTaskId = approvalValidation.approvalTask!.task_id;
      this.logger.log(`Auto-claiming approval task ${approvalTaskId} for supervisor ${supervisorId}`, CaseClosureApprovalService.name);
      await this.taskService.claimTask(approvalTaskId, supervisorId!, tenantId);

      const taskIndex = caseData.tasks.findIndex((task) => task.task_id === approvalTaskId);
      if (taskIndex >= 0) {
        caseData.tasks[taskIndex].assigned_user_id = supervisorId!;
        caseData.tasks[taskIndex].status = TaskStatus.STATUS_10_ASSIGNED;
      }

      approvalValidation = this.taskValidationUtil.validateApprovalTaskForClosure(caseData.tasks, {
        requireClaim: Boolean(supervisorId),
        expectedAssignee: supervisorId,
      });
    }

    this.taskValidationUtil.throwIfValidationFails(approvalValidation, 'Approval task validation failed');

    const { approvalTask } = approvalValidation;

    if (!approvalTask) {
      throw new NotFoundException('Approval task not found');
    }

    const otherTasksValidation = this.taskValidationUtil.validateOtherTasksCompleted(caseData.tasks, [approvalTask.task_id]);

    if (!otherTasksValidation.isValid) {
      throw new BadRequestException({
        message: 'All other tasks must be completed before approval',
        incompleteTasks: this.taskValidationUtil
          .filterTasks(caseData.tasks, {
            excludeTaskIds: [approvalTask.task_id],
            excludeStatuses: [TaskStatus.STATUS_30_COMPLETED],
          })
          .map((task) => ({
            taskId: task.task_id,
            name: task.name,
            status: task.status,
          })),
        caseId,
      });
    }

    return { caseData, approvalTask };
  }

  private validateCaseCompleteness(caseDetails: {
    priority?: Priority;
    case_type?: CaseType | null;
    case_creator_user_id?: string;
    tasks: Task[];
    comments: Comment[];
  }): string[] {
    const missing: string[] = [];

    if (!caseDetails.priority) {
      missing.push('Case priority');
    }

    if (!caseDetails.case_type) {
      missing.push('Case type');
    }

    if (!caseDetails.case_creator_user_id) {
      missing.push('Case creator');
    }

    const hasInvestigationTask = caseDetails.tasks.some(
      (t) => t.name && t.name === TASK_NAMES.INVESTIGATE_CASE && t.status === TaskStatus.STATUS_30_COMPLETED,
    );

    if (!hasInvestigationTask) {
      missing.push('Completed investigation task');
    }

    const closureComments = caseDetails.comments.filter(
      (c) => c.note.includes('Recommended Outcome') || c.note.includes('Final Investigation Summary'),
    );

    if (closureComments.length === 0) {
      missing.push('Investigation closure recommendation');
    }

    return missing;
  }
}
