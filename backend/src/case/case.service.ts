import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from 'src/audit/auditLog.service';
import { CaseStatus, TaskStatus, Priority, CaseCreationType, AlertType, CaseType } from '@prisma/client';
import { GetUserCasesQueryDto } from './dto/get-user-cases.dto';
import { CasePriorityUtil } from '../shared/utils/case-priority.util';
import { TaskValidationUtil } from '../shared/utils/task-validation.util';
import { GetAllCasesQueryDto } from './dto/get-all-cases.dto';
import { ManualCreateCaseDto } from './dto/manual-case-create.dto';
import { TaskService } from 'src/task/task.service';
import { CreateCommentDto } from 'src/comment/dto/create-comment.dto';
import { CommentService } from 'src/comment/comment.service';
import { CaseWorkflowService } from '../case-workflow/case-workflow.service';
import {
  CaseCreatedEvent,
  CaseAbandonedEvent,
  CaseStatusChangedEvent,
  TaskCompletedEvent,
  CaseSuspendedEvent,
  CaseResumedEvent,
} from '../events/domain-events';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
import { NotificationService } from '../notification/notification.service';
import { AuthHelperService } from 'src/auth/auth-helper.service';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly taskService: TaskService,
    private readonly commentService: CommentService,
    private readonly caseWorkflowService: CaseWorkflowService,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly notificationService: NotificationService,
    private readonly authHelperService: AuthHelperService,
  ) {}

  async createCaseSystemTransmission(payload: SystemCaseCreationDto, clientId: string, tenantId: string) {
    try {
      this.logger.log('System-to-system case creation initiated', CaseService.name);
      const systemUuid = this.configService.get<string>('SYSTEM_UUID', clientId);

      this.eventEmitter.emit('alert.incoming', {
        payload,
        source: 'REST API',
        userId: systemUuid,
        tenantId,
      });

      await this.auditLogService.logAction({
        userId: systemUuid,
        operation: 'createCase',
        entityName: CaseService.name,
        actionPerformed: 'Case creation triggered via system transmission',
        outcome: Outcome.SUCCESS,
      });
      return { message: 'Case creation triggered via system transmission' };
    } catch (error) {
      this.logger.error(`Error in system-to-system case creation: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    this.logger.log(`[ManualCase] Starting manual case creation by user ${userId} with role ${role}`, CaseService.name);

    if (!dto.alertId || !dto.alertType) {
      this.logger.error('[ManualCase] Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const existingAlert = await this.prismaService.alert.findUnique({
      where: { alert_id: dto.alertId },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert ${dto.alertId} not found`);
    }

    if (existingAlert.case_id) {
      this.logger.error(`[ManualCase] Case already exists for alertId ${dto.alertId}`, '', CaseService.name);
      throw new BadRequestException(`Case already exists for alertId ${dto.alertId}`);
    }

    const alertStatus = (existingAlert.alert_data as any)?.status;
    if (alertStatus !== 'NALT') {
      this.logger.error('[ManualCase] Cannot create Case: alert_data.status is not NALT', '', CaseService.name);
      throw new BadRequestException('Cannot create Case: alert_data.status is not NALT');
    }

    const priorityScore = dto.priorityScore ?? 0.33;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = this.casePriorityUtil.mapAlertTypeToCaseType(dto.alertType);

    const needsApproval = role !== 'SUPERVISOR';
    const caseStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
    const caseOwnerId = needsApproval ? undefined : userId;

    this.logger.log(
      `[ManualCase] Case will ${needsApproval ? 'require approval' : 'be auto-approved'}, status: ${caseStatus}`,
      CaseService.name,
    );

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const caseDetail: CreateCaseDto = {
          tenantId,
          caseCreatorUserId: userId,
          caseOwnerUserId: caseOwnerId,
          status: caseStatus,
          caseType,
          priority,
          caseCreationType: CaseCreationType.MANUAL,
        };

        const createdCase = await this.caseWorkflowService.createCase(caseDetail, userId);

        this.logger.log(`[ManualCase] Case ${createdCase.case_id} created via workflow service`, CaseService.name);

        const updatedAlert = await prisma.alert.update({
          where: { alert_id: dto.alertId },
          data: {
            priority,
            alert_type: dto.alertType,
            priority_score: priorityScore,
            case_id: createdCase.case_id,
          },
        });

        this.logger.log(`[ManualCase] Alert ${dto.alertId} linked to case ${createdCase.case_id}`, CaseService.name);

        let approvalTask: Awaited<ReturnType<typeof this.taskService.createTask>> | null = null;

        if (needsApproval) {
          approvalTask = await this.taskService.createTask(
            {
              caseId: createdCase.case_id,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: 'Approve Case Creation',
              description: `Manual case ${createdCase.case_id} created by investigator, requires supervisor approval`,
              candidateGroup: 'supervisors',
            },
            userId,
            this.auditLogService,
            this.logger,
          );

          this.logger.log(
            `[ManualCase] PostgreSQL approval task ${approvalTask.task_id} created for case ${createdCase.case_id}`,
            CaseService.name,
          );
        }

        return { case: createdCase, alert: updatedAlert, approvalTask };
      });

      this.logger.log(`[ManualCase] Manual case creation completed successfully for case ${result.case.case_id}`, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'createManualCase',
        entityName: CaseService.name,
        actionPerformed: `Manual case ${result.case.case_id} created for alert ${dto.alertId} by ${role}${needsApproval ? ' (pending supervisor approval)' : ''}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('[ManualCase] Manual case creation failed', { error: err, dto, userId, tenantId });
      throw new InternalServerErrorException(`Failed to create case & link alert: ${err.message}`);
    }
  }

  private async validateCaseCreationApprovalPreconditions(caseId: string): Promise<void> {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Creation',
          },
        },
        alert: {
          select: {
            alert_id: true,
            alert_type: true,
          },
        },
      },
    });

    if (!caseData) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseData.status !== CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending creation approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
      });
    }

    const missingFields: string[] = [];
    if (!caseData.priority) missingFields.push('priority');
    if (!caseData.case_type) missingFields.push('case_type');
    if (!caseData.case_creator_user_id) missingFields.push('case_creator_user_id');

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Case has missing required fields',
        missingFields,
      });
    }

    const approvalTask = caseData.tasks[0];
    if (!approvalTask) {
      throw new NotFoundException('Approve Case Creation task not found');
    }

    if (approvalTask.status !== TaskStatus.STATUS_01_UNASSIGNED) {
      throw new ConflictException({
        message: 'Approval task is not in correct state',
        currentStatus: approvalTask.status,
        requiredStatus: TaskStatus.STATUS_01_UNASSIGNED,
      });
    }
  }

  async approveCaseCreation(caseId: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`[ApproveCaseCreation] Supervisor ${supervisorId} approving case creation for case ${caseId}`, CaseService.name);

      await this.validateCaseCreationApprovalPreconditions(caseId);

      const result = await this.prismaService.$transaction(async (tx) => {
        // Update case status
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            updated_at: new Date(),
          },
        });

        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: 'Approve Case Creation',
            status: TaskStatus.STATUS_01_UNASSIGNED,
          },
        });

        if (!approvalTask) {
          throw new NotFoundException('Approve Case Creation task not found');
        }

        const completedApprovalTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        return { case: updatedCase, approvedTask: completedApprovalTask };
      });

      this.logger.log(
        `[ApproveCaseCreation] Case ${caseId} and approval task ${result.approvedTask.task_id} updated in PostgreSQL`,
        CaseService.name,
      );

      
      this.logger.log(
        `[ApproveCaseCreation] Emitting task.completed event for approval task ${result.approvedTask.task_id}`,
        CaseService.name,
      );

      this.eventEmitter.emit(
        'task.completed',
        new TaskCompletedEvent(result.approvedTask.task_id, caseId, supervisorId, {
          creationApproval: 'approve',
          creationComments: 'Case creation approved by supervisor',
        }),
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          'Case creation approved by supervisor',
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Approved case creation for case ${caseId}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`[ApproveCaseCreation] Case creation approved successfully for case ${caseId}`, CaseService.name);

      return {
        success: true,
        case: result.case,
        approvedTask: result.approvedTask,
      };
    } catch (error) {
      this.logger.error(`[ApproveCaseCreation] Failed to approve case creation: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Failed to approve case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async rejectCaseCreation(caseId: string, supervisorId: string, tenantId: string, reason: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case creation for case ${caseId}`, CaseService.name);
      await this.validateCaseCreationApprovalPreconditions(caseId);
      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Rejection reason is required and must be at least 10 characters');
      }
      const existingCase = await this.retrieveCase(caseId);

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_00_DRAFT, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve Case Creation', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException('Approve Case Creation task not found');

        const completedApprovalTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: supervisorId, updated_at: new Date() },
        });

        return { case: updatedCase, completedTask: completedApprovalTask };
      });

      const completeNewCaseTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          assignedUserId: existingCase.case_creator_user_id,
          name: 'Complete New Case',
          description: 'Revise and complete the case as per supervisor feedback',
          candidateGroup: 'investigations',
        },
        supervisorId,
        this.auditLogService,
        this.logger,
      );

      await this.prismaService.comment.create({
        data: {
          user_id: supervisorId,
          task_id: completeNewCaseTask.task_id,
          note: `Case creation rejected. Reason: ${reason}`,
        },
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          CaseStatus.STATUS_00_DRAFT,
          `Case creation rejected: ${reason}`,
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Rejected case creation for case ${caseId}, created Complete New Case task ${completeNewCaseTask.task_id}. Reason: ${reason}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: completeNewCaseTask };
    } catch (error) {
      this.logger.error(`Failed to reject case creation for case ${caseId}: ${error.message}`, error.stack, CaseService.name);
      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }

  //close case needs testing
  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string) {
    try {
      this.logger.log(`User ${userId} attempting to close case ${caseId}`, CaseService.name);

      const caseData = await this.prismaService.case.findFirst({
        where: {
          case_id: caseId,
          OR: [
            { case_owner_user_id: userId },
            { tasks: { some: { assigned_user_id: userId, name: { in: ['Investigate Case', 'Investigate case'] } } } },
          ],
        },
        include: {
          tasks: true,
          alert: true,
          comments: true,
        },
      });

      if (!caseData) {
        const errorMsg = `Case ${caseId} not found or you don't have permission to close it`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
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
          entityName: CaseService.name,
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

      const investigationTask = caseData.tasks.find((task) => task.name === 'Investigate Case' || task.name === 'Investigate case');

      if (!investigationTask) {
        const errorMsg = `Case closure failed: Investigation task not found for case ${caseId}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Investigation task not found for this case',
          caseId,
          missingTask: 'Investigate Case',
        });
      }

      if (investigationTask.assigned_user_id !== userId) {
        const errorMsg = `Case closure failed: Investigation task ${investigationTask.task_id} is not assigned to user ${userId}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
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

      if (investigationTask.status !== TaskStatus.STATUS_20_IN_PROGRESS) {
        const errorMsg = `Case closure failed: Investigation task status is ${investigationTask.status}, required: STATUS_20_IN_PROGRESS`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new ConflictException({
          message: 'Investigation task is not in progress',
          currentStatus: investigationTask.status,
          requiredStatus: TaskStatus.STATUS_20_IN_PROGRESS,
          taskId: investigationTask.task_id,
        });
      }

      const validationErrors = this.validateClosureData(dto);
      if (validationErrors.length > 0) {
        const errorMsg = `Case closure failed: Missing or invalid information: ${validationErrors.join(', ')}`;
        await this.auditLogService.logAction({
          userId,
          operation: 'closeCase',
          entityName: CaseService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Missing or invalid case closure information',
          errors: validationErrors,
          caseId,
        });
      }

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

        if (dto.finalNotes || dto.recommendations) {
          await tx.comment.create({
            data: {
              user_id: userId,
              case_id: caseId,
              note: `Final Investigation Summary:\n${dto.finalNotes || ''}\n\nRecommendations:\n${dto.recommendations || ''}\n\nRecommended Outcome: ${dto.recommendedOutcome}`,
            },
          });
        }

        return { updatedCase };
      });

      const approvalTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Approve case closure',
          description: `Review and approve case closure with recommended outcome: ${dto.recommendedOutcome}`,
          candidateGroup: 'supervisors',
        },
        userId,
        this.auditLogService,
        this.logger,
      );

      await this.prismaService.comment.create({
        data: {
          user_id: userId,
          task_id: approvalTask.task_id,
          note: JSON.stringify({
            recommendedOutcome: dto.recommendedOutcome,
            finalNotes: dto.finalNotes,
            recommendations: dto.recommendations,
            submittedBy: userId,
            submittedAt: new Date(),
          }),
        },
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_20_IN_PROGRESS,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          `Case closure requested with outcome: ${dto.recommendedOutcome}`,
        ),
      );

      try {
        await this.notificationService.sendGroupNotification({
          candidateGroup: 'supervisors',
          type: 'CASE_CLOSURE_PENDING',
          message: `Case ${caseId} submitted for closure approval`,
          metadata: {
            caseId,
            recommendedOutcome: dto.recommendedOutcome,
            submittedBy: userId,
            approvalTaskId: approvalTask.task_id,
          },
        });
      } catch (notificationError) {
        this.logger.warn(`Failed to send supervisor notification: ${notificationError.message}`, CaseService.name);
      }

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closed and submitted for approval with outcome: ${dto.recommendedOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closed successfully and submitted for approval',
        closed_case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        approval_task: {
          task_id: approvalTask.task_id,
          name: approvalTask.name,
          status: approvalTask.status,
          assigned_to: 'Supervisors',
        },
      };
    } catch (error) {
      const errorMessage = error.message || 'Unknown error occurred';

      this.logger.error(`Case closure failed for case ${caseId}: ${errorMessage}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
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

  private validateClosureData(dto: CloseCaseDto): string[] {
    const errors: string[] = [];

    if (!dto.recommendedOutcome) {
      errors.push('Recommended outcome is required');
    }

    const validOutcomes = ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'];

    if (dto.recommendedOutcome && !validOutcomes.includes(dto.recommendedOutcome)) {
      errors.push(`Invalid recommended outcome. Must be one of: ${validOutcomes.join(', ')}`);
    }

    if (!dto.finalNotes || dto.finalNotes.trim().length < 20) {
      errors.push('Final notes are required and must be at least 20 characters');
    }

    if (dto.recommendations && dto.recommendations.trim().length < 10) {
      errors.push('Recommendations must be at least 10 characters if provided');
    }

    return errors;
  }

  async suspendCase(caseId: string, reason: string, userId: string, tenantId: string) {
    const investigatorRoles = await this.authHelperService.getUserRolesFromAuthService(userId);
    if (!investigatorRoles.includes('CMS_INVESTIGATOR')) {
      this.logger.error(`User ${userId} does not have INVESTIGATOR role`, null, TaskService.name);
      throw new BadRequestException('Assigned user does not have INVESTIGATOR role');
    }

    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can suspend a case');

    if (existingCase.status !== CaseStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException('Only cases in "IN PROGRESS" status can be suspended');

    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for suspension is required');
    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === 'Investigate Case');

    if (!investigateTask) throw new BadRequestException('No "Investigate case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException(`Cannot suspend as Investigate case task ${investigateTask.task_id} is not in progress`);

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_21_SUSPENDED }, userId);

        const updatedTask = await this.taskService.updateTask(
          investigateTask.task_id,
          { status: TaskStatus.STATUS_21_BLOCKED },
          userId,
          this.auditLogService,
        );

        const createCommentDto = new CreateCommentDto();
        createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = `Case suspended: ${reason}`;
        await this.commentService.addComment(createCommentDto, userId);

        await this.auditLogService.logAction({
          userId,
          operation: 'suspendCase',
          entityName: CaseService.name,
          actionPerformed: `Suspend case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      await new Promise((res) => setTimeout(res, 1000));
      this.eventEmitter.emit('case.suspended', new CaseSuspendedEvent(caseId, reason));

      try {
        const caseAssignee = investigateTask.assigned_user_id;
        if (caseAssignee) {
          const assigneeUserDetail = await this.authHelperService.getUserDetailsFromAuthService(caseAssignee);
          const emailTo = assigneeUserDetail.email;
          const suspendedBy = assigneeUserDetail.username;
          await this.notificationService.sendCaseSuspensionEmail(`${emailTo}`, caseId, suspendedBy, reason);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send suspension notification for case ${caseId}: ${notificationError.message}`);
      }

      return { success: true, ...result };
    } catch (err) {
      await this.auditLogService.logAction({
        userId,
        operation: 'suspendCase',
        entityName: CaseService.name,
        actionPerformed: `Attempted to suspend case ${caseId}`,
        outcome: Outcome.FAILURE,
      });

      this.logger.error('suspendCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to suspend case: ${err.message}`);
    }
  }

  async resumeCase(caseId: string, reason: string, userId: string, tenantId: string) {
    const investigatorRoles = await this.authHelperService.getUserRolesFromAuthService(userId);
    if (!investigatorRoles.includes('CMS_INVESTIGATOR')) {
      this.logger.error(`User ${userId} does not have INVESTIGATOR role`, null, TaskService.name);
      throw new BadRequestException('Assigned user does not have INVESTIGATOR role');
    }
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for resumption is required');

    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can resume a case');

    if (existingCase.status !== CaseStatus.STATUS_21_SUSPENDED) throw new BadRequestException('Only suspended cases can be resumed');

    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === 'Investigate Case');

    if (!investigateTask) throw new BadRequestException('No "Investigate case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_21_BLOCKED)
      throw new BadRequestException(`Cannot resume as Investigate case task ${investigateTask.task_id} is not blocked`);

    try {
      await this.eventEmitter.emitAsync('case.resumed', new CaseResumedEvent(caseId, reason));

      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_20_IN_PROGRESS }, userId);
        const updatedTask = await this.taskService.updateTask(
          investigateTask.task_id,
          { status: TaskStatus.STATUS_20_IN_PROGRESS },
          userId,
          this.auditLogService,
        );

        const createCommentDto = new CreateCommentDto();
        createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = `Case resumed: ${reason}`;
        await this.commentService.addComment(createCommentDto, userId);

        await this.auditLogService.logAction({
          userId,
          operation: 'resumeCase',
          entityName: CaseService.name,
          actionPerformed: `Resume case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      try {
        const caseAssignee = investigateTask.assigned_user_id;
        if (caseAssignee) {
          const assigneeUserDetail = await this.authHelperService.getUserDetailsFromAuthService(caseAssignee);
          const emailTo = assigneeUserDetail.email;
          const resumedBy = assigneeUserDetail.username;
          await this.notificationService.sendCaseResumptionEmail(`${emailTo}`, caseId, resumedBy, reason);
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send resumption notification for case ${caseId}: ${notificationError.message}`);
      }

      return { success: true, ...result };
    } catch (err) {
      await this.auditLogService.logAction({
        userId,
        operation: 'resumeCase',
        entityName: CaseService.name,
        actionPerformed: `Attempted to resume case ${caseId}`,
        outcome: Outcome.FAILURE,
      });

      this.logger.error('resumeCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to resume case: ${err.message}`);
    }
  }

  // approve case reopening needs testing
  async approveCaseReopening(caseId: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} approving case reopening for ${caseId}`, CaseService.name);

      const caseData = await this.validateReopeningPreconditions(caseId);

      // Step 2: Find the reopening approval task
      const reopeningTask = await this.prismaService.task.findFirst({
        where: {
          case_id: caseId,
          name: 'Approve Case Reopening',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
        include: {
          comments: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

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
          this.logger.warn(`Failed to parse reopening metadata: ${parseError.message}`, CaseService.name);
        }
      }

      let newCaseStatus: CaseStatus;
      let newTaskStatus: TaskStatus;
      let assignedUserId: string | undefined;
      let candidateGroup: string;

      const isAnalystOrInvestigator =
        requesterRole &&
        (requesterRole.toUpperCase() === 'ANALYST' ||
          requesterRole.toUpperCase() === 'INVESTIGATOR' ||
          requesterRole.toUpperCase() === 'CMS_ANALYST' ||
          requesterRole.toUpperCase() === 'CMS_INVESTIGATOR');

      if (isAnalystOrInvestigator && requesterId) {
        newCaseStatus = CaseStatus.STATUS_10_ASSIGNED;
        newTaskStatus = TaskStatus.STATUS_10_ASSIGNED;
        assignedUserId = requesterId;
        candidateGroup = 'investigations';

        this.logger.log(`Reopening approved - assigning to original requester ${requesterId}`, CaseService.name);
      } else {
        newCaseStatus = CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
        newTaskStatus = TaskStatus.STATUS_01_UNASSIGNED;
        assignedUserId = undefined;
        candidateGroup = 'investigations';

        this.logger.log(
          `Reopening approved - assigning to investigations queue (requester role: ${requesterRole || 'unknown'})`,
          CaseService.name,
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

        const completedTask = await tx.task.update({
          where: { task_id: reopeningTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: reopeningTask.task_id,
            note: `Case reopening approved by supervisor. Previous status: ${caseData.status}. Reason: ${reopeningMetadata.reason || 'Not specified'}`,
          },
        });

        return { updatedCase, completedTask };
      });

      const investigationTask = await this.taskService.createTask(
        {
          caseId,
          status: newTaskStatus,
          assignedUserId,
          name: 'Investigate Case',
          description: `Case reopened for additional investigation. ${reopeningMetadata.reason || ''}`,
          candidateGroup,
        },
        supervisorId,
        this.auditLogService,
        this.logger,
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(caseId, CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL, newCaseStatus, 'Case reopening approved'),
      );

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
            },
          });
        } catch (notificationError) {
          this.logger.warn(`Failed to send analyst notification: ${notificationError.message}`, CaseService.name);
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
          this.logger.warn(`Failed to send group notification: ${notificationError.message}`, CaseService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} reopening approved. New investigation task ${investigationTask.task_id} created${assignedUserId ? ` and assigned to ${assignedUserId}` : ' in investigations queue'}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} reopening approved. Status: ${newCaseStatus}`, CaseService.name);

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
      this.logger.error(`Failed to approve case reopening: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Failed to approve case reopening for ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  // reject case needs testing
  async rejectCaseReopening(caseId: string, rejectionReason: string, supervisorId: string, tenantId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case reopening for ${caseId}`, CaseService.name);

      if (!rejectionReason || rejectionReason.trim().length < 20) {
        const errorMsg = 'Rejection reason must be at least 20 characters';
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'rejectCaseReopening',
          entityName: CaseService.name,
          actionPerformed: `Failed to reject case reopening for ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException(errorMsg);
      }

      const caseData = await this.validateReopeningPreconditions(caseId);

      const reopeningTask = await this.prismaService.task.findFirst({
        where: {
          case_id: caseId,
          name: 'Approve Case Reopening',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        },
        include: {
          comments: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!reopeningTask) {
        throw new NotFoundException(`"Approve Case Reopening" task not found for case ${caseId}`);
      }

      let requesterId: string | null = null;
      if (reopeningTask.comments.length > 0) {
        try {
          const metadata = JSON.parse(reopeningTask.comments[0].note);
          requesterId = metadata.requestedBy;
        } catch (parseError) {
          this.logger.warn(`Failed to parse reopening metadata: ${parseError.message}`, CaseService.name);
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

        await tx.comment.create({
          data: {
            user_id: supervisorId,
            task_id: reopeningTask.task_id,
            note: `Case reopening rejected by supervisor.\n\nReason: ${rejectionReason}\n\nCase restored to status: ${originalClosedStatus}`,
          },
        });

        return { updatedCase, completedTask };
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
          originalClosedStatus,
          `Case reopening rejected: ${rejectionReason}`,
        ),
      );

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
            },
          });
        } catch (notificationError) {
          this.logger.warn(`Failed to send rejection notification: ${notificationError.message}`, CaseService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} reopening rejected. Case restored to ${originalClosedStatus}. Reason: ${rejectionReason}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} reopening rejected. Restored to ${originalClosedStatus}`, CaseService.name);

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
      this.logger.error(`Failed to reject case reopening: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseReopening',
        entityName: CaseService.name,
        actionPerformed: `Failed to reject case reopening for ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  private async validateReopeningPreconditions(caseId: string): Promise<any> {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: {
        tasks: {
          where: {
            name: 'Approve Case Reopening',
          },
        },
      },
    });

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

  private determineOriginalClosedStatus(caseData: any): CaseStatus {
    const closedStatuses = [
      CaseStatus.STATUS_81_CLOSED_REFUTED,
      CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
      CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
      CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
    ];

    return CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE;
  }

  //need testing for new validations
  async approveCaseClosure(caseId: string, finalOutcome: string, comments: string | undefined, supervisorId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} attempting to approve case closure for ${caseId}`, CaseService.name);

      const validOutcomes = ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'];

      if (!finalOutcome || !validOutcomes.includes(finalOutcome)) {
        const errorMsg = `Invalid final outcome: ${finalOutcome}. Must be one of: ${validOutcomes.join(', ')}`;
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
          actionPerformed: `Failed to approve case ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException({
          message: 'Invalid final outcome',
          providedOutcome: finalOutcome,
          validOutcomes,
        });
      }

    try {
      await this.validateApprovalPreconditions(caseId);
      } catch (validationError) {
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
          actionPerformed: `Validation failed for case ${caseId}: ${validationError.message}`,
          outcome: Outcome.FAILURE,
        });
        throw validationError;
      }

      const caseDetails = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
        include: {
          tasks: true,
          alert: true,
          comments: {
            orderBy: { created_at: 'desc' },
            take: 5,
          },
        },
      });

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const missingInfo = this.validateCaseCompleteness(caseDetails);
      if (missingInfo.length > 0) {
        const errorMsg = `Case ${caseId} is missing required information: ${missingInfo.join(', ')}`;
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseClosure',
          entityName: CaseService.name,
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

        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: 'Approve case closure',
            status: TaskStatus.STATUS_01_UNASSIGNED,
          },
        });

        if (!approvalTask) {
          throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
        }

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });

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

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          finalOutcome as CaseStatus,
          `Case closure approved with outcome: ${finalOutcome}`,
        ),
      );

      const investigationTask = caseDetails.tasks.find(
        (t) => (t.name === 'Investigate Case' || t.name === 'Investigate case') && t.assigned_user_id,
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
          this.logger.warn(`Failed to send investigator notification: ${notificationError.message}`, CaseService.name);
        }
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closure approved with final outcome ${finalOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Case ${caseId} closure approved successfully with outcome ${finalOutcome}`, CaseService.name);

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

      this.logger.error(`Case closure approval failed for case ${caseId}: ${errorMessage}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseService.name,
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
      (t) => (t.name === 'Investigate Case' || t.name === 'Investigate case') && t.status === TaskStatus.STATUS_30_COMPLETED,
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

  //reject case closure needs testing
  async rejectCaseClosure(caseId: string, comments: string, supervisorId: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case closure for ${caseId}`, CaseService.name);

      await this.validateApprovalPreconditions(caseId);

      if (!comments || comments.trim().length < 20) {
        const errorMsg = 'Rejection comments must be at least 20 characters';
        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'rejectCaseClosure',
          entityName: CaseService.name,
          actionPerformed: `Failed to reject case ${caseId}: ${errorMsg}`,
          outcome: Outcome.FAILURE,
        });
        throw new BadRequestException(errorMsg);
      }

      const caseDetails = await this.prismaService.case.findUnique({
        where: { case_id: caseId },
        include: {
          tasks: {
            where: {
              name: { in: ['Investigate Case', 'Investigate case'] },
              status: TaskStatus.STATUS_30_COMPLETED,
            },
            orderBy: { updated_at: 'desc' },
          },
        },
      });

      if (!caseDetails) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      const originalInvestigationTask = caseDetails.tasks[0];
      const originalInvestigatorId = originalInvestigationTask?.assigned_user_id;

      if (!originalInvestigatorId) {
        throw new BadRequestException('Cannot determine original investigator for case reassignment');
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
            updated_at: new Date(),
          },
        });

        const approvalTask = await tx.task.findFirst({
          where: {
            case_id: caseId,
            name: 'Approve case closure',
            status: TaskStatus.STATUS_01_UNASSIGNED,
          },
        });

        if (!approvalTask) {
          throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);
        }

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

        return { updatedCase, completedTask };
      });

      const newInvestigationTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          assignedUserId: originalInvestigatorId,
          name: 'Investigate Case',
          description: 'Continue investigation based on supervisor feedback. Previous closure was rejected.',
          candidateGroup: 'investigations',
        },
        supervisorId,
        this.auditLogService,
        this.logger,
      );

      await this.prismaService.comment.create({
        data: {
          user_id: supervisorId,
          task_id: newInvestigationTask.task_id,
          note: `Supervisor Feedback:\n${comments}\n\nAction Required: Address the concerns raised and resubmit for closure approval.`,
        },
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
          `Case closure rejected: ${comments}`,
        ),
      );

      try {
        await this.notificationService.sendNotification({
          userId: originalInvestigatorId,
          type: 'CASE_CLOSURE_REJECTED',
          message: `Your case closure for case ${caseId} was rejected by supervisor`,
          metadata: {
            caseId,
            taskId: newInvestigationTask.task_id,
            supervisorComments: comments,
            rejectedBy: supervisorId,
          },
        });
      } catch (notificationError) {
        this.logger.warn(`Failed to send investigator notification: ${notificationError.message}`, CaseService.name);
      }

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closure rejected and reassigned to investigator ${originalInvestigatorId}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `Case ${caseId} closure rejected successfully. New investigation task ${newInvestigationTask.task_id} created`,
        CaseService.name,
      );

      return {
        message: 'Case closure rejected and returned for investigation',
        case: {
          case_id: result.updatedCase.case_id,
          status: result.updatedCase.status,
          updated_at: result.updatedCase.updated_at,
        },
        completed_approval_task: {
          task_id: result.completedTask.task_id,
          status: result.completedTask.status,
        },
        new_investigation_task: {
          task_id: newInvestigationTask.task_id,
          name: newInvestigationTask.name,
          assigned_to: originalInvestigatorId,
          status: newInvestigationTask.status,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to reject case closure: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async returnCaseForReview(caseId: string, comments: string, supervisorId: string) {
    try {
      await this.validateApprovalPreconditions(caseId);
      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve case closure', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: supervisorId, updated_at: new Date() },
        });

        await tx.comment.create({
          data: { user_id: supervisorId, task_id: approvalTask.task_id, note: `Returned for review: ${comments}` },
        });

        return { updatedCase, completedTask };
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          CaseStatus.STATUS_20_IN_PROGRESS,
          `Returned for review: ${comments}`,
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'returnCaseForReview',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} returned for additional review`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case returned for additional review',
        case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
      };
    } catch (error) {
      this.logger.error(`Failed to return case for review: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async reopenCase(caseId: string, reason: string, userId: string, tenantId: string) {
    try {
      this.logger.log(`Investigator ${userId} reopening case ${caseId}`, CaseService.name);

    const existingCase = await this.retrieveCase(caseId);

      const allowedStates: CaseStatus[] = [
        CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
        CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
        CaseStatus.STATUS_81_CLOSED_REFUTED,
        CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
      ];

      if (!allowedStates.includes(existingCase.status)) {
        throw new BadRequestException(`Case ${caseId} is not in a valid closed state for reopening`);
      }

      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Reason for reopening case is required and must be at least 10 characters');
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
            name: 'Approve Case Reopening',
            status: TaskStatus.STATUS_01_UNASSIGNED,
            description: `Case reopening approval required. Reason: ${reason}`,
            candidateGroup: 'supervisors',
          },
          userId,
          this.auditLogService,
          this.logger,
        );

        return { case: updatedCase, approvalTask };
      });

      this.eventEmitter.emit('case.created', new CaseCreatedEvent(caseId, tenantId, CaseCreationType.MANUAL, undefined, false));

      await this.auditLogService.logAction({
        userId,
        operation: 'reopenCase',
        entityName: CaseService.name,
        actionPerformed: `Reopened case ${caseId} pending supervisor approval. Reason: ${reason}`,
          outcome: Outcome.SUCCESS,
        });

      return {
        success: true,
        message: 'Case reopened and pending supervisor approval',
        case: result.case,
        approvalTask: result.approvalTask,
      };
    } catch (error) {
      this.logger.error(`Failed to reopen case ${caseId}: ${error.message}`, error.stack, CaseService.name);

      await this.auditLogService.logAction({
        userId,
        operation: 'reopenCase',
        entityName: CaseService.name,
        actionPerformed: `Failed to reopen case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async abandonCase(caseId: string, reason: string, userId: string, tenantId: string) {
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for abandonment is required');
    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case doesn't exist for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Cannot abandon case other than draft status');

    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');
    if (!completeNewCaseTask) throw new BadRequestException('No complete new Case Task exists');
    if (completeNewCaseTask?.status === TaskStatus.STATUS_30_COMPLETED) {
      throw new BadRequestException(`Cannot update Complete New Case task ${completeNewCaseTask.task_id} as it is already completed`);
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_99_ABANDONED }, userId);
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
          this.auditLogService,
        );
        const createCommentDto = new CreateCommentDto();
        createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = reason;
        this.commentService.addComment(createCommentDto, userId);

        await this.auditLogService.logAction({
          userId,
          operation: 'abandonCase',
          entityName: CaseService.name,
          actionPerformed: `Abandon case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      this.eventEmitter.emit('case.abandoned', new CaseAbandonedEvent(caseId, reason));

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('abandonCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to abandon case : ${err.message}`);
    }
  }

  async completeCase(caseId: string, userId: string, tenantId: string) {
    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Only cases in DRAFT status can be completed');

    const missingFields = this.validateCaseCompletionFields(existingCase);
    if (missingFields.length > 0) {
      const msg = `Missing or invalid fields: ${missingFields.join(', ')}`;
      await this.auditLogService.logAction({
        userId,
        operation: 'completeCase',
        entityName: CaseService.name,
        actionPerformed: `Failed case completion due to missing fields [${missingFields.join(', ')}]`,
        outcome: Outcome.FAILURE,
      });
      throw new BadRequestException(msg);
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.updateCase(caseId, { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }, userId);
        const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
        const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');
        if (!completeNewCaseTask) throw new BadRequestException('No Complete New Case task found');
        if (completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
          throw new BadRequestException(`Complete New Case task ${completeNewCaseTask.task_id} is already completed`);
        }
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
          this.auditLogService,
        );

        return { case: updatedCase, completedTask: updatedTask };
      });

      const investigateTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate case',
          description: `Task to investigate: ${caseId}`,
          candidateGroup: 'investigations',
        },
        userId,
        this.auditLogService,
        this.logger,
      );

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_00_DRAFT,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          'Case completed and ready for assignment',
        ),
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'completeCase',
        entityName: CaseService.name,
        actionPerformed: `Completed case ${caseId} and created Investigate Case task ${investigateTask.task_id}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: investigateTask };
    } catch (err) {
      this.logger.error('completeCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to complete case: ${err.message}`);
    }
  }

  private validateCaseCompletionFields(existingCase: any): string[] {
    const missing: string[] = [];
    if (!existingCase.priority) missing.push('priority');
    if (!existingCase.case_type) missing.push('case_type');
    return missing;
  }

  private async validateApprovalPreconditions(caseId: string) {
    const caseData = await this.prismaService.case.findUnique({
      where: { case_id: caseId },
      include: { tasks: true },
    });

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

    const approvalValidation = TaskValidationUtil.validateApprovalTaskForClosure(caseData.tasks);
    TaskValidationUtil.throwIfValidationFails(approvalValidation, 'Approval task validation failed');

    const approvalTask = TaskValidationUtil.findApprovalTask(caseData.tasks);
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
  }

  async getUserCases(userId: string, query: GetUserCasesQueryDto) {
    try {
      const {
        status,
        priority,
        includeTaskAssignments,
        includeOwnedCases,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;
      const skip = (page - 1) * limit;
      const whereConditions: any[] = [];

      if (includeOwnedCases) {
        const ownedCasesCondition: any = { case_owner_user_id: userId };
        if (status) ownedCasesCondition.status = status;
        if (priority) ownedCasesCondition.priority = priority;
        whereConditions.push(ownedCasesCondition);
      }

      if (includeTaskAssignments) {
        const taskAssignmentCondition: any = { tasks: { some: { assigned_user_id: userId } } };
        if (status) taskAssignmentCondition.status = status;
        if (priority) taskAssignmentCondition.priority = priority;
        whereConditions.push(taskAssignmentCondition);
      }

      if (whereConditions.length === 0) {
        return {
          cases: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
          summary: { totalOwnedCases: 0, totalTaskAssignments: 0, casesByStatus: {}, casesByPriority: {} },
        };
      }

      const totalCount = await this.prismaService.case.count({ where: { OR: whereConditions } });
      const cases = await this.prismaService.case.findMany({
        where: { OR: whereConditions },
        include: {
          tasks: { orderBy: { created_at: 'desc' } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, priority: true, alert_type: true } },
          comments: { select: { comment_id: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 1 },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      const processedCases = cases.map((caseItem) => {
        const isOwner = caseItem.case_owner_user_id === userId;
        const userTasks = TaskValidationUtil.getUserAssignedTasks(caseItem.tasks, userId);
        const hasTaskAssignment = userTasks.length > 0;
        const userRole: 'owner' | 'task_assignee' | 'both' = isOwner && hasTaskAssignment ? 'both' : isOwner ? 'owner' : 'task_assignee';

        return {
          case_id: caseItem.case_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          user_role: userRole,
          user_tasks: userTasks.map((task) => ({
            task_id: task.task_id,
            name: task.name,
            status: task.status,
            created_at: task.created_at,
          })),
          total_tasks: caseItem.tasks.length,
          alert: caseItem.alert
            ? { alert_id: caseItem.alert.alert_id, message: caseItem.alert.message, confidence_per: caseItem.alert.confidence_per }
            : undefined,
          latest_comment_date: caseItem.comments[0]?.created_at,
        };
      });

      const [ownedCasesCount, taskAssignmentCasesCount, casesByStatus, casesByPriority] = await Promise.all([
        this.prismaService.case.count({ where: { case_owner_user_id: userId } }),
        this.prismaService.case.count({ where: { tasks: { some: { assigned_user_id: userId } } } }),
        this.prismaService.case.groupBy({ by: ['status'], where: { OR: whereConditions }, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: { OR: whereConditions }, _count: { case_id: true } }),
      ]);

      const statusCounts = casesByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const priorityCounts = casesByPriority.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        cases: processedCases,
        pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        summary: {
          totalOwnedCases: ownedCasesCount,
          totalTaskAssignments: taskAssignmentCasesCount,
          casesByStatus: statusCounts,
          casesByPriority: priorityCounts,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get user cases: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async getAllCases(query: GetAllCasesQueryDto, supervisorId: string) {
    try {
      const {
        status,
        priority,
        caseType,
        ownerId,
        tenantId,
        unassignedOnly,
        createdAfter,
        createdBefore,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = query;
      const whereClause: any = {};
      if (status) whereClause.status = status;
      if (priority) whereClause.priority = priority;
      if (caseType) whereClause.case_type = caseType;
      if (ownerId) whereClause.case_owner_user_id = ownerId;
      if (tenantId) whereClause.tenant_id = tenantId;
      if (unassignedOnly) whereClause.case_owner_user_id = null;

      if (createdAfter || createdBefore) {
        whereClause.created_at = {};
        if (createdAfter) whereClause.created_at.gte = new Date(createdAfter);
        if (createdBefore) whereClause.created_at.lte = new Date(createdBefore);
      }

      const skip = (page - 1) * limit;
      const totalCount = await this.prismaService.case.count({ where: whereClause });
      const cases = await this.prismaService.case.findMany({
        where: whereClause,
        include: {
          tasks: { select: { task_id: true, status: true, assigned_user_id: true, name: true } },
          alert: { select: { alert_id: true, message: true, confidence_per: true, alert_type: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      const processedCases = cases.map((caseItem) => {
        const taskCounts = TaskValidationUtil.getTaskStatusCounts(caseItem.tasks);
        const assignedUsers = [...new Set(caseItem.tasks.map((t) => t.assigned_user_id).filter(Boolean))];
        return {
          case_id: caseItem.case_id,
          tenant_id: caseItem.tenant_id,
          case_creator_user_id: caseItem.case_creator_user_id,
          case_owner_user_id: caseItem.case_owner_user_id,
          status: caseItem.status,
          priority: caseItem.priority,
          case_type: caseItem.case_type,
          created_at: caseItem.created_at,
          updated_at: caseItem.updated_at,
          total_tasks: caseItem.tasks.length,
          completed_tasks: taskCounts.completed,
          pending_tasks: taskCounts.pending,
          alert: caseItem.alert,
          assigned_to:
            assignedUsers.length > 0
              ? { user_id: caseItem.case_owner_user_id || assignedUsers[0], task_count: assignedUsers.length }
              : undefined,
        };
      });

      const [statusStats, priorityStats, typeStats, unassignedCount] = await Promise.all([
        this.prismaService.case.groupBy({ by: ['status'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['priority'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.groupBy({ by: ['case_type'], where: whereClause, _count: { case_id: true } }),
        this.prismaService.case.count({ where: { case_owner_user_id: null } }),
      ]);

      const casesByStatus = statusStats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const casesByPriority = priorityStats.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const casesByType = typeStats.reduce(
        (acc, item) => {
          if (item.case_type) acc[item.case_type] = item._count.case_id;
          return acc;
        },
        {} as Record<string, number>,
      );
      const totalTasks = cases.reduce((sum, c) => sum + c.tasks.length, 0);
      const averageTasksPerCase = cases.length > 0 ? Math.round((totalTasks / cases.length) * 10) / 10 : 0;

      let oldestUnassignedCase: { case_id: string; created_at: Date; days_old: number } | undefined;
      if (unassignedCount > 0) {
        const oldestUnassigned = await this.prismaService.case.findFirst({
          where: { case_owner_user_id: null },
          orderBy: { created_at: 'asc' },
          select: { case_id: true, created_at: true },
        });
        if (oldestUnassigned) {
          const daysOld = Math.floor((new Date().getTime() - oldestUnassigned.created_at.getTime()) / (1000 * 60 * 60 * 24));
          oldestUnassignedCase = { case_id: oldestUnassigned.case_id, created_at: oldestUnassigned.created_at, days_old: daysOld };
        }
      }

      return {
        cases: processedCases,
        pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        statistics: {
          totalCases: totalCount,
          casesByStatus,
          casesByPriority,
          casesByType,
          unassignedCases: unassignedCount,
          averageTasksPerCase,
          oldestUnassignedCase,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get all cases: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async getUserWorkloadStats(userId: string) {
    try {
      const [activeCases, pendingTasks, allUserCases] = await Promise.all([
        this.prismaService.case.count({
          where: {
            OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
            status: {
              notIn: [
                CaseStatus.STATUS_81_CLOSED_REFUTED,
                CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                CaseStatus.STATUS_99_ABANDONED,
              ],
            },
          },
        }),
        this.prismaService.task.count({
          where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
        }),
        this.prismaService.case.findMany({
          where: {
            OR: [{ case_owner_user_id: userId }, { tasks: { some: { assigned_user_id: userId } } }],
            status: {
              notIn: [
                CaseStatus.STATUS_81_CLOSED_REFUTED,
                CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                CaseStatus.STATUS_99_ABANDONED,
              ],
            },
          },
          select: { case_id: true, status: true, priority: true, created_at: true },
          orderBy: { created_at: 'asc' },
        }),
      ]);

      const now = new Date();
      let oldestCase: { case_id: string; created_at: Date; days_old: number } | null = null;
      let totalAge = 0;

      if (allUserCases.length > 0) {
        const oldest = allUserCases[0];
        const daysOld = Math.floor((now.getTime() - oldest.created_at.getTime()) / (1000 * 60 * 60 * 24));
        oldestCase = { case_id: oldest.case_id, created_at: oldest.created_at, days_old: daysOld };
        allUserCases.forEach((c) => {
          totalAge += (now.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24);
        });
      }

      const casesByStatus: Record<string, number> = {};
      const casesByPriority: Record<string, number> = {};
      allUserCases.forEach((c) => {
        casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1;
        casesByPriority[c.priority] = (casesByPriority[c.priority] || 0) + 1;
      });

      const averageCaseAge = allUserCases.length > 0 ? Math.round((totalAge / allUserCases.length) * 10) / 10 : 0;
      const upcomingDeadlines = await this.prismaService.task.findMany({
        where: { assigned_user_id: userId, status: { in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS] } },
        select: { task_id: true, name: true, case_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: 5,
      });

      return {
        totalActiveCases: activeCases,
        totalPendingTasks: pendingTasks,
        casesByStatus,
        casesByPriority,
        oldestCase,
        averageCaseAge,
        upcomingTasks: upcomingDeadlines.map((task) => ({
          task_id: task.task_id,
          name: task.name,
          case_id: task.case_id,
          days_old: Math.floor((now.getTime() - task.created_at.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get workload stats: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async retrieveCase(caseId: string) {
    const retrievedCase = await this.prismaService.case.findUnique({ where: { case_id: caseId }, include: { alert: true, tasks: true } });
    if (!retrievedCase) throw new NotFoundException(`Case not found: ${caseId}`);
    return retrievedCase;
  }

  async updateCase(caseId: string, updateData: Partial<UpdateCaseDto>, userId: string) {
    try {
      const updatedCase = await this.prismaService.case.update({
        where: { case_id: caseId },
        data: {
          case_type: updateData.caseType,
          priority: updateData.priority,
          status: updateData.status,
          case_owner_user_id: updateData.caseOwnerUserId,
        },
      });

      this.auditLogService.logAction({
        userId,
        operation: 'updateCase',
        entityName: CaseService.name,
        actionPerformed: `Case updated successfully: ${updatedCase.case_id}`,
        outcome: Outcome.SUCCESS,
      });

      return updatedCase;
    } catch (error) {
      this.logger.error(`Error updating case: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }
}
