import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { Outcome } from '../../audit/types/outcome';
import { CaseStatus, Task, TaskStatus } from '@prisma/client';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import { TASK_NAMES, CANDIDATE_GROUPS, CASE_CLOSURE_OUTCOMES, VALIDATION_LENGTHS } from '../utils/constants/case.constants';
import { CloseCaseDto } from '../dto/index.dto';
import { NotificationService } from 'src/modules/notification/notification.service';
import { validateClosureData } from '../utils/helpers/case-validation.helper';
import { TaskValidationUtil } from 'src/modules/shared/utils/task-validation.util';
import { FlowableService } from 'src/modules/flowable/flowable.service';
import { CreateCommentDto } from 'src/modules/comment/dto/create-comment.dto';
import { CommentService } from 'src/modules/comment/comment.service';

@Injectable()
export class CaseClosureApprovalService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly caseRepository: CaseRepository,
    private readonly taskService: TaskService,
    private readonly notificationService: NotificationService,
    private readonly flowableService: FlowableService,
    private readonly commentService: CommentService,
  ) {}

  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string, role: string) {
    try {
      const caseData = await this.caseRepository.findCaseWithPermissionCheck(caseId, userId);
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
      const fraudTask = isFraudAndAmlCase ? caseData.tasks.find((task) => task.name === 'Investigate Fraud') : null;
      const amlTask = isFraudAndAmlCase ? caseData.tasks.find((task) => task.name === 'Investigate AML') : null;

      let investigationTasks: Task[] = [];
      let primaryTask: Task | null = null;

      if (isFraudAndAmlCase) {
        // Validate both tasks exist for FRAUD_AND_AML cases
        if (!fraudTask || !amlTask) {
          throw new BadRequestException({
            message: 'Both Fraud and AML investigation tasks must exist for FRAUD_AND_AML cases',
            caseId,
            caseType: caseData.case_type,
            foundTasks: caseData.tasks.filter((t) => t.name?.includes('Investigate')).map((t) => t.name),
          });
        }

        // FRAUD_AND_AML case - check both tasks
        investigationTasks = [fraudTask, amlTask];

        // Check if both tasks are completed
        const fraudCompleted = fraudTask.status === TaskStatus.STATUS_30_COMPLETED;
        const amlCompleted = amlTask.status === TaskStatus.STATUS_30_COMPLETED;

        if (!fraudCompleted || !amlCompleted) {
          throw new ConflictException({
            message: 'Both Fraud and AML investigation tasks must be completed before closing FRAUD_AND_AML case',
            caseId,
            fraudTaskStatus: fraudTask.status,
            amlTaskStatus: amlTask.status,
            requiredStatus: TaskStatus.STATUS_30_COMPLETED,
          });
        }

        // For user assignment check, use the task assigned to the current user
        const userTask = [fraudTask, amlTask].find((task) => task.assigned_user_id === userId);
        if (!userTask) {
          throw new BadRequestException({
            message: 'Neither Fraud nor AML investigation task is assigned to you',
            caseId,
            fraudTaskAssignedTo: fraudTask.assigned_user_id,
            amlTaskAssignedTo: amlTask.assigned_user_id,
            userId,
          });
        }

        primaryTask = userTask; // Use the user's assigned task as primary
      } else {
        // Single investigation case
        const investigationTask = caseData.tasks.find((task) => TASK_NAMES.INVESTIGATE_CASE_VARIANTS.includes(task.name as any));

        if (!investigationTask) {
          throw new BadRequestException({
            message: 'Investigation task not found for this case',
            caseId,
            missingTask: TASK_NAMES.INVESTIGATE_CASE,
          });
        }

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

        investigationTasks = [investigationTask];
        primaryTask = investigationTask;
      }

      const validationErrors = validateClosureData(dto);
      if (validationErrors.length > 0) {
        throw new BadRequestException({
          message: 'Missing or invalid case closure information',
          errors: validationErrors,
          caseId,
        });
      }

      // SUPERVISOR DIRECT CLOSURE PATH
      if (role === 'CMS_SUPERVISOR') {
        const finalStatus = dto.recommendedOutcome as CaseStatus;

        const result = await this.caseRepository.updateCaseStatusAndCompleteTask(
          caseId,
          finalStatus,
          primaryTask.task_id,
          userId,
          dto.finalNotes
            ? {
                note: `Supervisor Direct Closure:\n${dto.recommendedOutcome}${isFraudAndAmlCase ? ' (Both Fraud and AML investigations completed)' : ''}\n${dto.finalNotes}\nFinal Outcome: ${dto.recommendedOutcome}`,
              }
            : undefined,
        );

        if (isFraudAndAmlCase) {
          // Handle both fraud and AML tasks separately
          await this.flowableService.handleTaskCompleted({
            caseId,
            taskName: 'Investigate Fraud',
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              fraudInvestigationAction: 'complete',
              amlInvestigationAction: 'complete',
              fraudRecommendedOutcome: dto.recommendedOutcome,
              fraudInvestigationNotes: dto.finalNotes,
            },
          });

          await this.flowableService.handleTaskCompleted({
            caseId,
            taskName: 'Investigate AML',
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              fraudInvestigationAction: 'complete',
              amlInvestigationAction: 'complete',
              amlRecommendedOutcome: dto.recommendedOutcome,
              amlInvestigationNotes: dto.finalNotes,
            },
          });
        } else {
          await this.flowableService.handleTaskCompleted({
            caseId,
            taskName: 'Investigate Case',
            newStatus: TaskStatus.STATUS_30_COMPLETED,
            completionVariables: {
              investigationAction: 'complete',
              fraudInvestigationAction: 'complete',
              amlInvestigationAction: 'complete',
              recommendedOutcome: dto.recommendedOutcome,
              investigationNotes: dto.finalNotes,
            },
          });
        }

        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Supervisor closed case ${caseId} with outcome: ${dto.recommendedOutcome}`,
          outcome: Outcome.SUCCESS,
        });

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
      );

      const result = await this.caseRepository.updateCaseStatusAndCompleteTask(
        caseId,
        CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        primaryTask.task_id,
        userId,
        dto.finalNotes
          ? {
              note: `Final Investigation Summary${isFraudAndAmlCase ? ' (Both Fraud and AML investigations completed)' : ''}:\n${dto.finalNotes}\n\nRecommended Outcome: ${dto.recommendedOutcome}`,
              taskId: approvalTask.task_id,
            }
          : undefined,
      );

      if (isFraudAndAmlCase) {
        // Handle both fraud and AML tasks separately
        await this.flowableService.handleTaskCompleted({
          caseId,
          taskName: 'Investigate Fraud',
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            fraudInvestigationAction: 'requestClosure',
            amlInvestigationAction: 'requestClosure',
            fraudRecommendedOutcome: dto.recommendedOutcome,
            fraudInvestigationNotes: dto.finalNotes,
          },
        });

        await this.flowableService.handleTaskCompleted({
          caseId,
          taskName: 'Investigate AML',
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            fraudInvestigationAction: 'requestClosure',
            amlInvestigationAction: 'requestClosure',
            amlRecommendedOutcome: dto.recommendedOutcome,
            amlInvestigationNotes: dto.finalNotes,
          },
        });
      } else {
        await this.flowableService.handleTaskCompleted({
          caseId,
          taskName: 'Investigate Case',
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            investigationAction: 'requestClosure',
            fraudInvestigationAction: 'requestClosure',
            amlInvestigationAction: 'requestClosure',
            recommendedOutcome: dto.recommendedOutcome,
            investigationNotes: dto.finalNotes,
          },
        });
      }

      await this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        reason: `Case closure requested with outcome: ${dto.recommendedOutcome}`,
      });

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Case ${caseId} submitted for approval with outcome: ${dto.recommendedOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closed and submitted for approval',
        closed_case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
      };
    } catch (error) {
      this.logger.error(`Case closure failed: ${error.message}`, error.stack, CaseClosureApprovalService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to close case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'System error occurred during case closure',
        caseId,
        error: error.message,
      });
    }
  }

  async approveCaseClosure(caseId: string, finalOutcome: string, comments: string, supervisorId: string) {
    try {
      if (!finalOutcome || !CASE_CLOSURE_OUTCOMES.includes(finalOutcome as any)) {
        throw new BadRequestException({
          message: 'Invalid final outcome',
          providedOutcome: finalOutcome,
          validOutcomes: CASE_CLOSURE_OUTCOMES,
        });
      }

      const caseDetails = await this.caseRepository.findCaseForClosureApproval(caseId);

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
        comments,
      );

      this.flowableService.handleTaskCompleted({
        caseId,
        taskName: approvalTask.name || 'Approve Case Closure',
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        completionVariables: {
          approvalDecision: 'approve',
          finalOutcome: finalOutcome,
          supervisorComments: comments,
        },
      });

      await this.commentService.addComment(
        {
          caseId: caseId,
          taskId: approvalTask.task_id,
          note: `Supervisor Approval:\n${comments}\n\nFinal Outcome: ${finalOutcome}`,
        } as CreateCommentDto,
        supervisorId,
      );

      const investigationTask = caseDetails.tasks.find(
        (t) => t.name && TASK_NAMES.INVESTIGATE_CASE_VARIANTS.includes(t.name as any) && t.assigned_user_id,
      );

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
          this.logger.warn(`Failed to send investigator notification: ${notificationError.message}`, CaseClosureApprovalService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Case ${caseId} closure approved with final outcome ${finalOutcome}`,
        outcome: Outcome.SUCCESS,
      });

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
      const errorMessage = error.message || 'Unknown error occurred';

      this.logger.error(
        `[ApproveCaseClosure] Case closure approval failed for case ${caseId}: ${errorMessage}`,
        error.stack,
        CaseClosureApprovalService.name,
      );

      await this.auditLogService.logAction({
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

  async rejectCaseClosure(caseId: string, comments: string, supervisorId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case closure for ${caseId}`, CaseClosureApprovalService.name);

      await this.validateApprovalPreconditions(caseId, supervisorId, { autoClaimApprovalTask: true });

      if (!comments || comments.trim().length < VALIDATION_LENGTHS.MIN_REJECTION_REASON) {
        const errorMsg = `Rejection comments must be at least ${VALIDATION_LENGTHS.MIN_REJECTION_REASON} characters`;
        throw new BadRequestException(errorMsg);
      }

      const caseDetails = await this.caseRepository.findCaseWithCompletedInvestigation(caseId);

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const originalInvestigationTask = caseDetails.tasks[0];
      const originalInvestigatorId = originalInvestigationTask?.assigned_user_id;

      if (!originalInvestigatorId) {
        throw new BadRequestException('Cannot determine original investigator for case reassignment');
      }

      const result = await this.caseRepository.rejectClosureTask(caseId, supervisorId, originalInvestigatorId, comments, TASK_NAMES);

      // Notify Flowable about case status change FIRST to set the BPMN state
      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_20_IN_PROGRESS,
        reason: `Case closure rejected and returned to investigator: ${comments}`,
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
        this.logger.warn(`Failed to send notification to requesting user: ${notificationError.message}`, CaseClosureApprovalService.name);
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Case ${caseId} closure rejected. New investigation task ${result.newInvestigationTask.task_id} created and assigned to user ${originalInvestigatorId}`,
        outcome: Outcome.SUCCESS,
      });

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
      this.logger.error(`Failed to reject case closure: ${error.message}`, error.stack, CaseClosureApprovalService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async returnCaseForReview(caseId: string, comments: string, supervisorId: string) {
    try {
      await this.validateApprovalPreconditions(caseId, supervisorId, { autoClaimApprovalTask: true });

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

        await tx.comment.create({
          data: { user_id: supervisorId, task_id: approvalTask.task_id, note: `Returned for review: ${comments}` },
        });

        return { updatedCase, completedTask };
      });

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_20_IN_PROGRESS,
        reason: `Case returned for review by supervisor: ${comments}`,
      });

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'returnCaseForReview',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Case ${caseId} returned for additional review`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case returned for additional review',
        case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
      };
    } catch (error) {
      this.logger.error(`Failed to return case for review: ${error.message}`, error.stack, CaseClosureApprovalService.name);
      throw error;
    }
  }

  private async validateApprovalPreconditions(caseId: string, supervisorId?: string, options: { autoClaimApprovalTask?: boolean } = {}) {
    const caseData = await this.caseRepository.findCaseForReview(caseId);

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

    let approvalValidation = TaskValidationUtil.validateApprovalTaskForClosure(caseData.tasks, {
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
      await this.taskService.claimTask(approvalTaskId, supervisorId!, this.auditLogService);

      const taskIndex = caseData.tasks.findIndex((task) => task.task_id === approvalTaskId);
      if (taskIndex >= 0) {
        caseData.tasks[taskIndex].assigned_user_id = supervisorId!;
        caseData.tasks[taskIndex].status = TaskStatus.STATUS_10_ASSIGNED;
      }

      approvalValidation = TaskValidationUtil.validateApprovalTaskForClosure(caseData.tasks, {
        requireClaim: Boolean(supervisorId),
        expectedAssignee: supervisorId,
      });
    }

    TaskValidationUtil.throwIfValidationFails(approvalValidation, 'Approval task validation failed');

    const approvalTask = approvalValidation.approvalTask;

    if (!approvalTask) {
      throw new NotFoundException('Approval task not found');
    }

    const otherTasksValidation = TaskValidationUtil.validateOtherTasksCompleted(caseData.tasks, [approvalTask.task_id]);

    if (!otherTasksValidation.isValid) {
      throw new BadRequestException({
        message: 'All other tasks must be completed before approval',
        incompleteTasks: TaskValidationUtil.filterTasks(caseData.tasks, {
          excludeTaskIds: [approvalTask.task_id],
          excludeStatuses: [TaskStatus.STATUS_30_COMPLETED],
        }).map((task) => ({
          taskId: task.task_id,
          name: task.name,
          status: task.status,
        })),
        caseId,
      });
    }

    return { caseData, approvalTask };
  }

  private validateCaseCompleteness(caseDetails: any): string[] {
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
      (t) => t.name && TASK_NAMES.INVESTIGATE_CASE_VARIANTS.includes(t.name as any) && t.status === TaskStatus.STATUS_30_COMPLETED,
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
