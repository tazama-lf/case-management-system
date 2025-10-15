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
  CaseSuspendedEvent,
  CaseResumedEvent,
} from '../events/domain-events';
import { SystemCaseCreationDto } from './dto/system-case-creation.dto';
import { NotificationService } from 'src/notification/notification.service';
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
        actionPerformed: `Case creation triggered via system transmission`,
        outcome: Outcome.SUCCESS,
      });
      return { message: 'Case creation triggered via system transmission' };
    } catch (error) {
      this.logger.error(`Error in system-to-system case creation: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    if (!dto.alertId || !dto.alertType) {
      this.logger.error('Missing required fields in ManualCreateCaseDto', '', CaseService.name);
      throw new BadRequestException('alertId and alertType are required');
    }

    const existingAlert = await this.prismaService.alert.findUnique({
      where: { alert_id: dto.alertId },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert ${dto.alertId} not found`);
    }

    if (existingAlert.case_id) {
      this.logger.error(`Case already exists for alertId ${dto.alertId}`, '', CaseService.name);
      throw new BadRequestException(`Case already exists for alertId ${dto.alertId}`);
    }

    const alertStatus = (existingAlert.alert_data as any)?.status;
    if (alertStatus !== 'NALT') {
      this.logger.error('Cannot create Case: alert_data.status is not NALT', '', CaseService.name);
      throw new BadRequestException('Cannot create Case: alert_data.status is not NALT');
    }

    const priorityScore = dto.priorityScore ?? 0.33;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = this.casePriorityUtil.mapAlertTypeToCaseType(dto.alertType);

    const needsApproval = role !== 'SUPERVISOR';
    const caseStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_10_ASSIGNED;
    const caseOwnerId = needsApproval ? undefined : userId;

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

        const updatedAlert = await prisma.alert.update({
          where: { alert_id: dto.alertId },
          data: {
            priority,
            alert_type: dto.alertType,
            priority_score: priorityScore,
            case_id: createdCase.case_id,
          },
        });

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
          this.logger.log(`Created Approve Case Creation task ${approvalTask.task_id} for case ${createdCase.case_id}`, CaseService.name);
        }

        return { case: createdCase, alert: updatedAlert, approvalTask };
      });

      this.eventEmitter.emit('case.created', new CaseCreatedEvent(result.case.case_id, tenantId, 'MANUAL', role, false));

      await this.auditLogService.logAction({
        userId,
        operation: 'createManualCase',
        entityName: CaseService.name,
        actionPerformed: `Manual case ${result.case.case_id} created for alert ${dto.alertId} by ${role}${needsApproval ? ' (pending supervisor approval)' : ''}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('manualCaseCreate failed', { error: err, dto, userId, tenantId });
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
      this.logger.log(`Supervisor ${supervisorId} approving case creation for case ${caseId}`, CaseService.name);
      await this.validateCaseCreationApprovalPreconditions(caseId);

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve Case Creation', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException('Approve Case Creation task not found');

        const completedApprovalTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: supervisorId, updated_at: new Date() },
        });

        return { case: updatedCase, approvedTask: completedApprovalTask };
      });

      const investigateTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate case',
          description: `Investigation task for case ${caseId}`,
          candidateGroup: 'investigations',
        },
        supervisorId,
        this.auditLogService,
        this.logger,
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
        actionPerformed: `Approved case creation for case ${caseId}, created investigate task ${investigateTask.task_id}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, approvedTask: result.approvedTask, newTask: investigateTask };
    } catch (error) {
      this.logger.error(`Failed to approve case creation: ${error.message}`, error.stack, CaseService.name);
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
  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string) {
    try {
      this.logger.log(`Closing case ${caseId} by user ${userId}`, CaseService.name);
      const caseData = await this.prismaService.case.findFirst({
        where: {
          case_id: caseId,
          OR: [
            { case_owner_user_id: userId },
            { tasks: { some: { assigned_user_id: userId, name: { in: ['Investigate Case', 'Investigate case'] } } } },
          ],
        },
        include: { tasks: true, alert: true },
      });

      if (!caseData) throw new NotFoundException(`Case ${caseId} not found or you don't have permission to close it`);
      await this.validateCaseClosurePreconditions(caseData, userId);
      const investigationTask = caseData.tasks.find((task) => task.name === 'Investigate Case' || task.name === 'Investigate case');
      if (!investigationTask) throw new BadRequestException('Investigation task not found for this case');

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL, updated_at: new Date() },
        });

        await tx.task.update({
          where: { task_id: investigationTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, updated_at: new Date() },
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

      await this.auditLogService.logAction({
        userId,
        operation: 'closeCase',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closed and submitted for approval with outcome: ${dto.recommendedOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closed successfully and submitted for approval',
        closed_case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
        approval_task: { task_id: approvalTask.task_id, name: approvalTask.name, status: approvalTask.status, assigned_to: 'Supervisors' },
      };
    } catch (error) {
      this.logger.error(`Failed to close case ${caseId}: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async approveCaseClosure(caseId: string, finalOutcome: string, comments: string | undefined, supervisorId: string) {
    try {
      await this.validateApprovalPreconditions(caseId);
      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: finalOutcome as CaseStatus, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve case closure', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException(`"Approve case closure" task not found for case ${caseId}`);

        const completedTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: { status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: supervisorId, updated_at: new Date() },
        });

        if (comments) {
          await tx.comment.create({
            data: { user_id: supervisorId, task_id: approvalTask.task_id, note: `Supervisor Approval: ${comments}` },
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

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closure approved with final outcome ${finalOutcome}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closure approved',
        case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
        completed_task: { task_id: result.completedTask.task_id, status: result.completedTask.status },
      };
    } catch (error) {
      this.logger.error(`Failed to approve case closure: ${error.message}`, error.stack, CaseService.name);
      throw error;
    }
  }

  async rejectCaseClosure(caseId: string, comments: string, supervisorId: string) {
    try {
      await this.validateApprovalPreconditions(caseId);
      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_03_RETURNED, updated_at: new Date() },
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
          data: { user_id: supervisorId, task_id: approvalTask.task_id, note: `Case closure rejected: ${comments}` },
        });

        return { updatedCase, completedTask };
      });

      this.eventEmitter.emit(
        'case.status.changed',
        new CaseStatusChangedEvent(
          caseId,
          CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
          CaseStatus.STATUS_03_RETURNED,
          `Case closure rejected: ${comments}`,
        ),
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseClosure',
        entityName: CaseService.name,
        actionPerformed: `Case ${caseId} closure rejected and returned for investigation`,
        outcome: Outcome.SUCCESS,
      });

      return {
        message: 'Case closure rejected',
        case: { case_id: result.updatedCase.case_id, status: result.updatedCase.status, updated_at: result.updatedCase.updated_at },
      };
    } catch (error) {
      this.logger.error(`Failed to reject case closure: ${error.message}`, error.stack, CaseService.name);
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

  async suspendCase(caseId: string, reason: string, userId: string, tenantId: string) {
    const investigatorRoles = await this.authHelperService.getUserRolesFromAuthService(userId);
    if (!investigatorRoles.includes('CMS_INVESTIGATOR')) {
      this.logger.error(`User ${userId} does not have INVESTIGATOR role`, null, TaskService.name);
      throw new BadRequestException('Assigned user does not have INVESTIGATOR role');
    }

    const existingCase = await this.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException(`Only Case owner can suspend a case`);

    if (existingCase.status !== CaseStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException('Only cases in "IN PROGRESS" status can be suspended');

    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for suspension is required');
    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === 'Investigate case');

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
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException(`Only Case owner can resume a case`);

    if (existingCase.status !== CaseStatus.STATUS_21_SUSPENDED) throw new BadRequestException('Only suspended cases can be resumed');

    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === 'Investigate case');

    if (!investigateTask) throw new BadRequestException('No "Investigate case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_21_BLOCKED)
      throw new BadRequestException(`Cannot resume as Investigate case task ${investigateTask.task_id} is not blocked`);

    try {
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

      this.eventEmitter.emit('case.resumed', new CaseResumedEvent(caseId, reason));

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
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException(`Only cases in DRAFT status can be completed`);

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
    const caseData = await this.prismaService.case.findUnique({ where: { case_id: caseId }, include: { tasks: true } });
    if (!caseData) throw new NotFoundException(`Case ${caseId} not found`);
    if (caseData.status !== CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL) {
      throw new ConflictException({
        message: 'Case is not pending final approval',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
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
        }).map((task) => ({ taskId: task.task_id, name: task.name, status: task.status })),
      });
    }
  }

  private async validateCaseClosurePreconditions(caseData: any, userId: string): Promise<{ valid: boolean; message: string }> {
    if (caseData.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
      throw new ConflictException({
        message: 'Case is not in a closeable state',
        currentStatus: caseData.status,
        requiredStatus: CaseStatus.STATUS_20_IN_PROGRESS,
      });
    }
    const validationResult = TaskValidationUtil.validateCaseClosurePreconditions(caseData.tasks);
    TaskValidationUtil.throwIfValidationFails(validationResult, 'Case closure preconditions not met');
    return { valid: true, message: 'All case closure preconditions met successfully' };
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
        let userRole: 'owner' | 'task_assignee' | 'both' = isOwner && hasTaskAssignment ? 'both' : isOwner ? 'owner' : 'task_assignee';

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
