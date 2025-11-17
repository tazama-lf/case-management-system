import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Outcome } from '../../audit/types/outcome';
import { CaseStatus, TaskStatus, CaseType, CaseCreationType } from '@prisma/client';
import { ManualCreateCaseDto, CreateCaseDto, UpdateCaseDto } from '../dto/index.dto';
import { TaskService } from 'src/modules/task/task.service';
import { CaseCreationService } from '../../case-creation/case-creation.service';
import { SystemCaseCreationDto } from '../dto/system-case-creation.dto';
import { TASK_NAMES, CANDIDATE_GROUPS, VALIDATION_LENGTHS } from '../utils/constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { CasePriorityUtil } from '../../shared/utils/case-priority.util';
import { CaseQueryService } from './case-query.service';

@Injectable()
export class CaseCreationApprovalService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly taskService: TaskService,
    private readonly caseRepository: CaseRepository,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly caseCreationService: CaseCreationService,
    private readonly caseQueryService: CaseQueryService,
  ) {}

  private validateCaseCompletionFields(existingCase: any): string[] {
    const missing: string[] = [];
    if (!existingCase.priority) missing.push('priority');
    if (!existingCase.case_type) missing.push('case_type');
    return missing;
  }

  async createCaseSystemTransmission(payload: SystemCaseCreationDto, clientId: string, tenantId: string) {
    try {
      this.logger.log('System-to-system case creation initiated', CaseCreationApprovalService.name);

      await this.auditLogService.logAction({
        userId: clientId,
        operation: 'createCase',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: 'Case creation triggered via system transmission',
        outcome: Outcome.SUCCESS,
      });
      return { message: 'Case creation triggered via system transmission' };
    } catch (error) {
      this.logger.error(`Error in system-to-system case creation: ${error.message}`, error.stack, CaseCreationApprovalService.name);
      throw error;
    }
  }

  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    this.logger.log(`[ManualCase] Starting manual case creation by user ${userId} with role ${role}`, CaseCreationApprovalService.name);

    const existingAlert = await this.caseRepository.findCaseByAlertId(dto.alertId);

    if (!existingAlert) {
      throw new NotFoundException(`Alert ${dto.alertId} not found`);
    }

    if (existingAlert.case_id) {
      throw new BadRequestException(`Case already exists for alertId ${dto.alertId}`);
    }

    if ((existingAlert.alert_data as any)?.status !== 'NALT') {
      throw new BadRequestException('Can only create manual cases from alerts with NALT status');
    }

    const priorityScore = dto.priorityScore;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = (CaseType as Record<string, CaseType>)[dto.alertType] ?? CaseType.NONE;

    const isSupervisor = role === 'SUPERVISOR';

    const needsApproval = !isSupervisor;
    const caseStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
    const caseOwnerId = needsApproval ? undefined : userId;

    this.logger.log(
      `[ManualCase] Case will ${needsApproval ? 'require approval' : 'be auto-approved'}, status: ${caseStatus}, role: ${role}`,
      CaseCreationService.name,
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

        const createdCase = await this.caseCreationService.createCase(caseDetail, userId, role);

        this.logger.log(`[ManualCase] Case ${createdCase.case_id} created via workflow service`, CaseCreationApprovalService.name);

        const updatedAlert = await this.caseRepository.updateAlertByAlertId(dto, priorityScore, createdCase, priority);

        this.logger.log(`[ManualCase] Alert ${dto.alertId} linked to case ${createdCase.case_id}`, CaseCreationApprovalService.name);
        return { case: createdCase, alert: updatedAlert };
      });

      this.logger.log(
        `[ManualCase] Case ${result.case.case_id} created. BPMN will create ${needsApproval ? 'approval task' : 'investigation task'} automatically.`,
        CaseCreationService.name,
      );

      this.logger.log(
        `[ManualCase] Manual case creation completed successfully for case ${result.case.case_id}`,
        CaseCreationApprovalService.name,
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'createManualCase',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Manual case ${result.case.case_id} created for alert ${dto.alertId} by ${role}${needsApproval ? ' (pending supervisor approval, BPMN will create approval task)' : ' (auto-approved, BPMN will create investigation task)'}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        case: result.case,
        alert: result.alert,
        message: needsApproval
          ? 'Case created and pending approval. Approval task will be created by workflow engine.'
          : 'Case created and ready for investigation. Investigation task will be created by workflow engine.',
        requiresApproval: needsApproval,
        creatorRole: role,
      };
    } catch (err) {
      this.logger.error('[ManualCase] Manual case creation failed', { error: err, dto, userId, tenantId });
      throw new InternalServerErrorException(`Failed to create case & link alert: ${err.message}`);
    }
  }

  private async validateCaseCreationApprovalPreconditions(caseId: string): Promise<void> {
    const caseData = await this.caseRepository.findCaseWithApprovalTask(caseId);

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
      this.logger.log(
        `[ApproveCaseCreation] Supervisor ${supervisorId} approving case creation for case ${caseId}`,
        CaseCreationApprovalService.name,
      );

      // First check the case status
      const caseData = await this.caseRepository.findCaseBasicInfo(caseId);

      if (!caseData) {
        throw new NotFoundException(`Case ${caseId} not found`);
      }

      if (caseData.status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT) {
        const errorMsg = `Case ${caseId} was already approved (created by supervisor). Current status: ${caseData.status}`;
        this.logger.warn(`[ApproveCaseCreation] ${errorMsg}`, CaseCreationApprovalService.name);

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseCreation',
          entityName: CaseCreationApprovalService.name,
          actionPerformed: errorMsg,
          outcome: Outcome.FAILURE,
        });

        throw new ConflictException({
          message: 'Case does not require approval - it was already approved when created by a supervisor',
          currentStatus: caseData.status,
          caseId,
          note: 'This case was created by a supervisor and skipped the approval workflow',
        });
      }

      if (caseData.status !== CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL) {
        throw new ConflictException({
          message: 'Case is not pending creation approval',
          currentStatus: caseData.status,
          requiredStatus: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          caseId,
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

      const approvalTask = await this.caseRepository.findTaskByNameAndStatus(
        caseId,
        'Approve Case Creation',
        TaskStatus.STATUS_01_UNASSIGNED,
      );

      if (!approvalTask) {
        const errorMsg = 'Approve Case Creation task not found';
        this.logger.error(`[ApproveCaseCreation] ${errorMsg} for case ${caseId}`, null, CaseCreationApprovalService.name);

        await this.auditLogService.logAction({
          userId: supervisorId,
          operation: 'approveCaseCreation',
          entityName: CaseCreationApprovalService.name,
          actionPerformed: `${errorMsg} for case ${caseId}`,
          outcome: Outcome.FAILURE,
        });

        throw new NotFoundException(
          `${errorMsg}. The case may have been created by a supervisor and doesn't require approval, or the BPMN workflow has not yet created the task.`,
        );
      }

      if (approvalTask.status !== TaskStatus.STATUS_01_UNASSIGNED) {
        throw new ConflictException({
          message: 'Approval task is not in correct state',
          currentStatus: approvalTask.status,
          requiredStatus: TaskStatus.STATUS_01_UNASSIGNED,
        });
      }

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: {
            status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            updated_at: new Date(),
          },
        });

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

      // Emit case status changed

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Approved case creation for case ${caseId}. BPMN will create investigation task.`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `[ApproveCaseCreation] Case creation approved successfully for case ${caseId}. BPMN will create investigation task automatically.`,
        CaseCreationApprovalService.name,
      );

      setTimeout(async () => {
        try {
          const investigationTask = await this.caseRepository.findTaskByNames(
            caseId,
            [...TASK_NAMES.INVESTIGATE_CASE_VARIANTS],
            TaskStatus.STATUS_01_UNASSIGNED,
          );

          if (investigationTask) {
            this.logger.log(
              `[ApproveCaseCreation] Investigation task ${investigationTask.task_id} created successfully for case ${caseId}`,
              CaseCreationApprovalService.name,
            );
          } else {
            this.logger.warn(
              `[ApproveCaseCreation] Investigation task not found after 3 seconds for case ${caseId}. BPMN may still be processing.`,
              CaseCreationApprovalService.name,
            );
          }
        } catch (error) {
          this.logger.warn(
            `[ApproveCaseCreation] Failed to verify investigation task creation: ${error.message}`,
            CaseCreationApprovalService.name,
          );
        }
      }, 3000);

      return {
        success: true,
        case: result.case,
        approvedTask: result.approvedTask,
        message: 'Case creation approved. Investigation task will be created by workflow engine.',
      };
    } catch (error) {
      this.logger.error(
        `[ApproveCaseCreation] Failed to approve case creation: ${error.message}`,
        error.stack,
        CaseCreationApprovalService.name,
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Failed to approve case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async rejectCaseCreation(caseId: string, supervisorId: string, tenantId: string, reason: string) {
    try {
      this.logger.log(`Supervisor ${supervisorId} rejecting case creation for case ${caseId}`, CaseCreationApprovalService.name);
      await this.validateCaseCreationApprovalPreconditions(caseId);

      if (!reason || reason.trim().length < VALIDATION_LENGTHS.MIN_REOPENING_REASON) {
        throw new BadRequestException(
          `Rejection reason is required and must be at least ${VALIDATION_LENGTHS.MIN_REOPENING_REASON} characters`,
        );
      }

      const existingCase = await this.caseQueryService.retrieveCase(caseId);

      const result = await this.prismaService.$transaction(async (tx) => {
        const updatedCase = await tx.case.update({
          where: { case_id: caseId },
          data: { status: CaseStatus.STATUS_00_DRAFT, updated_at: new Date() },
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve Case Creation', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException('Approve Case Creation task not found');

        await this.taskService.updateTask(
          approvalTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED, assignedUserId: supervisorId },
          supervisorId,
          this.auditLogService,
        );

        return { case: updatedCase, completedTask: approvalTask };
      });

      const completeNewCaseTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_10_ASSIGNED,
          assignedUserId: existingCase.case_creator_user_id,
          name: 'Complete New Case',
          description: 'Revise and complete the case as per supervisor feedback',
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        supervisorId,
      );

      await this.caseRepository.createComment({
        user_id: supervisorId,
        task_id: completeNewCaseTask.task_id,
        note: `Case creation rejected. Reason: ${reason}`,
      });

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Rejected case creation for case ${caseId}, created Complete New Case task ${completeNewCaseTask.task_id}. Reason: ${reason}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: completeNewCaseTask };
    } catch (error) {
      this.logger.error(
        `Failed to reject case creation for case ${caseId}: ${error.message}`,
        error.stack,
        CaseCreationApprovalService.name,
      );
      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${error.message}`,
        outcome: Outcome.FAILURE,
      });
      throw error;
    }
  }

  async completeCase(caseId: string, userId: string, tenantId: string) {
    const existingCase = await this.caseQueryService.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Only cases in DRAFT status can be completed');

    const missingFields = this.validateCaseCompletionFields(existingCase);
    if (missingFields.length > 0) {
      const msg = `Missing or invalid fields: ${missingFields.join(', ')}`;
      await this.auditLogService.logAction({
        userId,
        operation: 'completeCase',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Failed case completion due to missing fields [${missingFields.join(', ')}]`,
        outcome: Outcome.FAILURE,
      });
      throw new BadRequestException(msg);
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }, userId);
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
          name: TASK_NAMES.INVESTIGATE_CASE_LOWER,
          description: `Task to investigate: ${caseId}`,
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        userId,
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'completeCase',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Completed case ${caseId} and created Investigate Case task ${investigateTask.task_id}`,
        outcome: Outcome.SUCCESS,
      });

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: investigateTask };
    } catch (err) {
      this.logger.error('completeCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to complete case: ${err.message}`);
    }
  }
}
