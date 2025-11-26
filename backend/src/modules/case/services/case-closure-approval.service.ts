import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { Outcome } from '../../audit/types/outcome';
import { CaseStatus, TaskStatus } from '@prisma/client';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import { TASK_NAMES, CANDIDATE_GROUPS, CASE_CLOSURE_OUTCOMES, VALIDATION_LENGTHS } from '../utils/constants/case.constants';
import { CloseCaseDto } from '../dto/index.dto';
import { NotificationService } from 'src/modules/notification/notification.service';
import { validateClosureData } from '../utils/helpers/case-validation.helper';
import { TaskValidationUtil } from 'src/modules/shared/utils/task-validation.util';
import { FlowableService } from 'src/modules/flowable/flowable.service';

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
  ) {}

  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string, role: string) {
    try {
      this.logger.log(`User ${userId} attempting to close case ${caseId}`, CaseClosureApprovalService.name);

      const caseData = await this.caseRepository.findCaseWithPermissionCheck(caseId, userId);

      if (!caseData) {
        const errorMsg = `Case ${caseId} not found or you don't have permission to close it`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new NotFoundException(errorMsg);
      }

      if (caseData.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
        const errorMsg = `Case closure failed: Case is not in progress. Current status: ${caseData.status}, Required status: STATUS_20_IN_PROGRESS`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });

        throw new ConflictException({
          message: 'Case is not in a closeable state',
          currentStatus: caseData.status,
          requiredStatus: CaseStatus.STATUS_20_IN_PROGRESS,
          caseId,
        });
      }

      const investigationTask = caseData.tasks.find((task) => TASK_NAMES.INVESTIGATE_CASE_VARIANTS.includes(task.name as any));

      if (!investigationTask) {
        const errorMsg = `Case closure failed: Investigation task not found for case ${caseId}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Investigation task not found for this case',
          caseId,
          missingTask: TASK_NAMES.INVESTIGATE_CASE,
        });
      }

      if (investigationTask.assigned_user_id !== userId) {
        const errorMsg = `Case closure failed: Investigation task ${investigationTask.task_id} is not assigned to user ${userId}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Investigation task is not assigned to you',
          caseId,
          taskId: investigationTask.task_id,
          assignedTo: investigationTask.assigned_user_id,
        });
      }

      if (investigationTask.status !== TaskStatus.STATUS_20_IN_PROGRESS && investigationTask.status !== TaskStatus.STATUS_30_COMPLETED) {
        const errorMsg = `Case closure failed: Investigation task status is ${investigationTask.status}, required: STATUS_20_IN_PROGRESS or STATUS_30_COMPLETED`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new ConflictException({
          message: 'Investigation task must be in progress or completed to close case',
          currentStatus: investigationTask.status,
          requiredStatuses: [TaskStatus.STATUS_20_IN_PROGRESS, TaskStatus.STATUS_30_COMPLETED],
          taskId: investigationTask.task_id,
        });
      }

      const validationErrors = validateClosureData(dto);
      if (validationErrors.length > 0) {
        const errorMsg = `Case closure failed: Missing or invalid information: ${validationErrors.join(', ')}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Missing or invalid case closure information',
          errors: validationErrors,
          caseId,
        });
      }

      const isSupervisor = role === 'CMS_SUPERVISOR';

      // **SUPERVISOR DIRECT CLOSURE PATH**
      if (isSupervisor) {
        this.logger.log(`Supervisor ${userId} is closing case ${caseId} directly without approval`, CaseClosureApprovalService.name);

        const finalStatus = dto.recommendedOutcome as CaseStatus;
        const oldTaskStatus = investigationTask.status;

        this.logger.log(
          `[CloseCase-Supervisor] Investigation task ${investigationTask.task_id} current status: ${oldTaskStatus}`,
          CaseClosureApprovalService.name,
        );

        const result = await this.prismaService.$transaction(async (tx) => {
          const updatedCase = await tx.case.update({
            where: { case_id: caseId },
            data: {
              status: finalStatus,
              updated_at: new Date(),
            },
          });

          await tx.task.update({
            where: { task_id: investigationTask.task_id },
            data: {
              status: TaskStatus.STATUS_30_COMPLETED,
              updated_at: new Date(),
            },
          });

          if (dto.finalNotes) {
            await tx.comment.create({
              data: {
                user_id: userId,
                case_id: caseId,
                note: `Supervisor Direct Closure:\n${dto.finalNotes || ''}\nFinal Outcome: ${dto.recommendedOutcome}`,
              },
            });
          }

          return { updatedCase };
        });

        if (oldTaskStatus !== TaskStatus.STATUS_30_COMPLETED) {
          this.logger.log(
            `[CloseCase-Supervisor] Emitting task.status.changed event for task ${investigationTask.task_id}: ${oldTaskStatus} -> STATUS_30_COMPLETED`,
            CaseClosureApprovalService.name,
          );
        }

        await this.flowableService.handleTaskStatusChanged({
          taskId: investigationTask.task_id,
          caseId,
          taskName: investigationTask.name || 'Investigate Case',
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          assignedUserId: userId,
          completionVariables: {
            investigationAction: 'directClose',
            finalOutcome: dto.recommendedOutcome,
            finalNotes: dto.finalNotes,
            supervisorClosure: true,
          },
        });

        await this.flowableService.handleCaseStatusChanged({
          caseId,
          newStatus: finalStatus,
          reason: `Case closed directly by supervisor with outcome: ${dto.recommendedOutcome}`,
        });

        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Supervisor ${userId} closed case ${caseId} directly with outcome: ${dto.recommendedOutcome}`,
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

      const oldTaskStatus = investigationTask.status;

      this.logger.log(
        `[CloseCase] Investigation task ${investigationTask.task_id} current status: ${oldTaskStatus}`,
        CaseClosureApprovalService.name,
      );

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            updated_at: new Date(),
          },
        });

        await tx.task.update({
          where: { task_id: investigationTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            updated_at: new Date(),
          },
        });

        const createTask = await this.taskService.createTask({
            caseId,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: TASK_NAMES.APPROVE_CASE_CLOSURE,
            description: `Review and approve case closure for case ${caseId}`,
            candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
          },
          userId,
        );

        if (dto.finalNotes) {
          await tx.comment.create({
            data: {
              user_id: userId,
              task_id: createTask.task_id,
              case_id: caseId,
              note: `Final Investigation Summary:\n${dto.finalNotes || ''}\n\nRecommended Outcome: ${dto.recommendedOutcome}`,
            },
          });
        }

        return { updatedCase };
      });

      this.logger.log(
        `[CloseCase] Emitting task.status.changed event for task ${investigationTask.task_id}: ${oldTaskStatus} -> STATUS_30_COMPLETED`,
        CaseClosureApprovalService.name,
      );

    //   await this.flowableService.handleTaskStatusChanged({
    //     taskId: investigationTask.task_id,
    //     caseId,
    //     taskName: investigationTask.name || 'Investigate Case',
    //     newStatus: TaskStatus.STATUS_30_COMPLETED,
    //     assignedUserId: userId,
    //     completionVariables: {
    //       investigationAction: 'requestClosure',
    //       recommendedOutcome: dto.recommendedOutcome,
    //       finalNotes: dto.finalNotes,
    //     },
    //   });

      await this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        reason: `Case closure requested with outcome: ${dto.recommendedOutcome}`,
      });

      // Sync BPMN tasks after a delay to allow BPMN engine to create approval task
    //   setTimeout(async () => {
    //     try {
    //       const tasks = await this.taskService.getTasksByCaseId(caseId);
    //       const approvalTask = tasks.find(
    //         (t) =>
    //           t.name && TASK_NAMES.APPROVE_CASE_CLOSURE_VARIANTS.includes(t.name as any) && t.status === TaskStatus.STATUS_01_UNASSIGNED,
    //       );

    //       if (approvalTask) {
    //         this.logger.log(`[CloseCase] Found BPMN-created approval task ${approvalTask.task_id}`, CaseClosureApprovalService.name);

    //         await this.caseRepository.createComment({
    //           user_id: userId,
    //           task_id: approvalTask.task_id,
    //           note: JSON.stringify({
    //             recommendedOutcome: dto.recommendedOutcome,
    //             finalNotes: dto.finalNotes,
    //             submittedBy: userId,
    //             submittedAt: new Date(),
    //           }),
    //         });

    //         this.logger.log(`[CloseCase] Added closure metadata to approval task ${approvalTask.task_id}`, CaseClosureApprovalService.name);

    //         try {
    //           await this.notificationService.sendGroupNotification({
    //             candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
    //             type: 'CASE_CLOSURE_PENDING',
    //             message: `Case ${caseId} submitted for closure approval`,
    //             metadata: {
    //               caseId,
    //               recommendedOutcome: dto.recommendedOutcome,
    //               submittedBy: userId,
    //               approvalTaskId: approvalTask.task_id,
    //             },
    //           });
    //         } catch (notificationError) {
    //           this.logger.warn(`Failed to send supervisor notification: ${notificationError.message}`, CaseClosureApprovalService.name);
    //         }
    //       } else {
    //         this.logger.warn(
    //           '[CloseCase] Approval task not found after 4 seconds. Checking if BPMN process is still running...',
    //           CaseClosureApprovalService.name,
    //         );

    //         this.logger.log(
    //           `[CloseCase] Current tasks in case ${caseId}: ${tasks.map((t) => `${t.name}(${t.status})`).join(', ')}`,
    //           CaseClosureApprovalService.name,
    //         );
    //       }
    //     } catch (error) {
    //       this.logger.error(`[CloseCase] Failed to add closure metadata: ${error.message}`, error.stack, CaseClosureApprovalService.name);
    //     }
    //   }, 4000);

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseClosureApprovalService.name,
        actionPerformed: `Case ${caseId} closed and submitted for approval with outcome: ${dto.recommendedOutcome}. BPMN will create approval task.`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closed successfully and submitted for approval. Approval task will be created by workflow engine.',
        closed_case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        approval_task_note: 'Approval task will be created automatically by the workflow engine',
      };
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';

      this.logger.error(`Case closure failed for case ${caseId}: ${errorMessage}`, error.stack, CaseClosureApprovalService.name);

      await this.auditLogService.logAction({
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
        timestamp: new Date().toISOString(),
      });
    }
  }

  async approveCaseClosure(caseId: string, finalOutcome: string, comments: string | undefined, supervisorId: string) {
    try {
      this.logger.log(
        `[ApproveCaseClosure] Supervisor ${supervisorId} attempting to approve case closure for ${caseId}`,
        CaseClosureApprovalService.name,
      );

      if (!finalOutcome || !CASE_CLOSURE_OUTCOMES.includes(finalOutcome as any)) {
        const errorMsg = `Invalid final outcome: ${finalOutcome}. Must be one of: ${CASE_CLOSURE_OUTCOMES.join(', ')}`;
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Failed to approve case ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
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

      this.logger.log(
        `[ApproveCaseClosure] Case status: ${caseDetails.status}, Tasks count: ${caseDetails.tasks.length}`,
        CaseClosureApprovalService.name,
      );

      // Log all tasks for debugging
      caseDetails.tasks.forEach((task) => {
        this.logger.log(
          `[ApproveCaseClosure] Task: ${task.name} (${task.task_id}), Status: ${task.status}, Assigned: ${task.assigned_user_id}`,
          CaseClosureApprovalService.name,
        );
      });

      if (caseDetails.status !== CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL) {
        const errorMsg = `Case is not pending final approval. Current: ${caseDetails.status}, Required: STATUS_22_PENDING_FINAL_APPROVAL`;
        this.logger.warn(`[ApproveCaseClosure] ${errorMsg}`, CaseClosureApprovalService.name);

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });

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
        this.logger.error(
          `[ApproveCaseClosure] ${errorMsg}. Available tasks: ${caseDetails.tasks.map((t) => `${t.name}(${t.status})`).join(', ')}`,
          null,
          CaseClosureApprovalService.name,
        );

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `${errorMsg} for case ${caseId}`,
          outcome: Outcome.FAILURE,
        });

        throw new NotFoundException({
          message: `${errorMsg}. The BPMN workflow may not have created the task yet.`,
          availableTasks: caseDetails.tasks.map((t) => ({ name: t.name, status: t.status })),
          caseId,
        });
      }

      this.logger.log(
        `[ApproveCaseClosure] Found approval task ${approvalTask.task_id} with status ${approvalTask.status}`,
        CaseClosureApprovalService.name,
      );

      const missingInfo = this.validateCaseCompleteness(caseDetails);
      if (missingInfo.length > 0) {
        const errorMsg = `Case ${caseId} is missing required information: ${missingInfo.join(', ')}`;
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Case has incomplete information',
          missingInformation: missingInfo,
          caseId,
        });
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case to final status
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: finalOutcome as CaseStatus,
            updated_at: new Date(),
          },
        });

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        // Add supervisor comments
        if (comments) {
          await tx.comment.create({
            data: {
              user_id: supervisorId,
              task_id: approvalTask.task_id,
              note: `Supervisor Approval:\n${comments}\n\nFinal Outcome: ${finalOutcome}`,
            },
          });
        } else {
          await tx.comment.create({
            data: {
              user_id: supervisorId,
              task_id: approvalTask.task_id,
              note: `Case closure approved with outcome: ${finalOutcome}`,
            },
          });
        }

        return { updatedCase, completedTask };
      });

      this.flowableService.handleTaskStatusChanged({
        taskId: result.completedTask.task_id,
        caseId,
        taskName: approvalTask.name || 'Approve Case Closure',
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        assignedUserId: supervisorId,
        completionVariables: {
          approvalDecision: 'approve',
          finalOutcome: finalOutcome,
          supervisorComments: comments,
        },
      });

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: finalOutcome as CaseStatus,
        reason: `Case closure approved with outcome: ${finalOutcome}`,
      });

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
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'rejectCaseClosure',
          entityName: CaseClosureApprovalService.name,
          actionPerformed: `Failed to reject case ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
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

      const result = await this.prismaService.$transaction(async (tx) => {
        // Find approval task first
        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: { in: [TASK_NAMES.APPROVE_CASE_CLOSURE, TASK_NAMES.APPROVE_CASE_CLOSURE_LOWER] },
            assigned_user_id: supervisorId,
            status: {
              in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
            },
          },
        });

        if (!approvalTask) {
          throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
        }

        // Complete the approval task
        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: approvalTask.task_id,
            note: `Case closure rejected by supervisor: ${comments}`,
          },
        });

        // Create new investigation task assigned to the user who requested approval
        const newInvestigationTask = await tx.task.create({
          data: {
            case_id: caseId,
            name: TASK_NAMES.INVESTIGATE_CASE,
            description: 'Continue investigation based on supervisor feedback. Previous closure was rejected.',
            status: TaskStatus.STATUS_10_ASSIGNED,
            assigned_user_id: originalInvestigatorId,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        // Add supervisor feedback as comment on new investigation task
        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: newInvestigationTask.task_id,
            note: `Supervisor Feedback:\n${comments}\n\nAction Required: Address the concerns raised and resubmit for closure approval.`,
          },
        });

        // Update case status LAST to prevent BPMN from overriding it
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_20_IN_PROGRESS,
            updated_at: new Date(),
          },
        });

        return { updatedCase, completedTask, newInvestigationTask };
      });

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

      // Notify workflow engine about new investigation task creation
      this.flowableService.handleTaskStatusChanged({
        taskId: result.newInvestigationTask.task_id,
        caseId,
        taskName: result.newInvestigationTask.name || 'Investigate Case',
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
        assignedUserId: originalInvestigatorId,
        completionVariables: {
          reason: 'Case closure rejected by supervisor',
          supervisorComments: comments,
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
