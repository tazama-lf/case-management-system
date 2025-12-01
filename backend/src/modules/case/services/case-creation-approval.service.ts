import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Outcome } from '../../audit/types/outcome';
import { CaseStatus, TaskStatus, CaseType, CaseCreationType, Priority, Case } from '@prisma/client';
import { ManualCreateCaseDto, CreateCaseDto, UpdateCaseDto } from '../dto/index.dto';
import { TaskService } from 'src/modules/task/task.service';
import { SystemCaseCreationDto } from '../dto/system-case-creation.dto';
import { TASK_NAMES, CANDIDATE_GROUPS, VALIDATION_LENGTHS } from '../utils/constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { CasePriorityUtil } from '../../shared/utils/case-priority.util';
import { CaseQueryService } from './case-query.service';
import { FlowableService } from '../..//flowable/flowable.service';
import { ConfigService } from '@nestjs/config';
import { TaskRepository } from 'src/modules/repository/task.repository';
import { AlertRepository } from 'src/modules/repository/alert.repository';

@Injectable()
export class CaseCreationApprovalService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly taskService: TaskService,
    private readonly alertRepository: AlertRepository,
    private readonly taskRepository: TaskRepository,
    private readonly caseRepository: CaseRepository,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly flowableService: FlowableService,
    private readonly caseQueryService: CaseQueryService,
  ) {}

  private validateCaseCompletionFields(existingCase: any): string[] {
    const missing: string[] = [];
    if (!existingCase.priority) missing.push('priority');
    if (!existingCase.case_type) missing.push('case_type');
    return missing;
  }

  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    this.logger.log(`Start - Manual Case Creation`, CaseCreationApprovalService.name);

    const existingAlert = await this.caseRepository.findAlert(dto.alertId);

    if (!existingAlert || existingAlert.case_id || (existingAlert.alert_data as unknown as { status: string })?.status !== 'NALT') {
      throw new BadRequestException(`Case Already Exists`);
    }

    const priorityScore = dto.priorityScore;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = dto.alertType;

    const needsApproval = role !== 'SUPERVISOR';
    const caseStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
    const caseOwnerId = needsApproval ? undefined : userId;

    try {
      const result = await this.caseRepository.executeTransaction(async (tx) => {
        const caseDetail: CreateCaseDto = {
          tenantId,
          caseCreatorUserId: userId,
          caseOwnerUserId: caseOwnerId,
          status: caseStatus,
          caseType,
          priority,
          caseCreationType: CaseCreationType.MANUAL,
        };

        const createdCase = await this.caseRepository.createCase(caseDetail, tx);
        await this.flowableService.handleCaseCreated({
          caseId: createdCase.case_id,
          tenantId,
          caseStatus,
          creationType: CaseCreationType.MANUAL,
          isTriageAlert: false,
          creatorRole: role,
        });

        const updatedAlert = await this.alertRepository.updateAlert(
          dto.alertId,
          {
            caseId: createdCase.case_id,
            priority: priority,
            priority_score: priorityScore,
            alertType: dto.alertType,
          },
          tx,
        );
        await this.flowableService.handleTaskCompleted({
          caseId: createdCase.case_id,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          taskName: 'Complete New Case',
          completionVariables: {
            autoCloseEligible: false,
            readyForAssignment: true,
            casePriority: priority,
          },
        });

        return { case: createdCase, alert: updatedAlert };
      });

      if (needsApproval) {
        await this.taskService.createTask(
          {
            caseId: result.case.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: 'Approve Case Creation',
            description: `Manual Case Creation Approval For Case ${result.case.case_id}`,
            candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
          },
          userId,
        );
      } else {
        await this.taskService.createTask(
          {
            caseId: result.case.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: 'Investigate Case',
            description: `Investigation task for manually created case ${result.case.case_id}`,
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          },
          userId,
        );
      }

      this.logger.log(
        `[ManualCase] Manual case creation completed successfully for case ${result.case.case_id}`,
        CaseCreationApprovalService.name,
      );

      await this.auditLogService.logAction({
        userId,
        operation: 'createManualCase',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Manual case ${result.case.case_id} created for alert ${dto.alertId} by ${role}${needsApproval ? ' (pending supervisor approval)' : ' (auto-approved)'}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        case: result.case,
        alert: result.alert,
      };
    } catch (err) {
      this.logger.error('[ManualCase] Manual case creation failed', { error: err, dto, userId, tenantId });
      throw new InternalServerErrorException(`Failed to create case & link alert: ${err.message}`);
    }
  }

  /**
   * Save a case as draft
   * Creates a case with DRAFT status and a "Complete New Case" task assigned to the creator
   * Used when user wants to save incomplete case information and complete it later
   *
   * @param dto - Manual case creation data including alert ID and priority
   * @param userId - ID of the user saving the draft
   * @param tenantId - Tenant ID for multi-tenancy
   * @param role - User's role (SUPERVISOR or INVESTIGATOR)
   * @returns Created case, alert, and success message
   * @throws NotFoundException if alert doesn't exist
   * @throws BadRequestException if alert already has a case or is not NALT status
   */
  async saveCaseAsDraft(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    this.logger.log(`Start - Save As Draft`, CaseCreationApprovalService.name);

    const existingAlert = await this.caseRepository.findAlert(dto.alertId);

    if (!existingAlert || existingAlert.case_id || (existingAlert.alert_data as any)?.status !== 'NALT') {
      throw new BadRequestException(
        !existingAlert
          ? `Alert ${dto.alertId} not found`
          : existingAlert.case_id
            ? `Case already exists for alertId ${dto.alertId}`
            : 'Can only create manual cases from alerts with NALT status',
      );
    }

    const priorityScore = dto.priorityScore;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = (CaseType as Record<string, CaseType>)[dto.alertType] ?? CaseType.NONE;

    try {
      const caseDetail: CreateCaseDto = {
        tenantId,
        caseCreatorUserId: userId,
        caseOwnerUserId: userId,
        status: CaseStatus.STATUS_00_DRAFT,
        caseType,
        priority,
        caseCreationType: CaseCreationType.MANUAL,
      };

      const result = await this.caseRepository.createDraftCase(caseDetail, dto, priorityScore, priority);
      await this.flowableService.handleCaseCreated({
        caseId: result.case.case_id,
        tenantId,
        caseStatus: CaseStatus.STATUS_00_DRAFT,
        creationType: CaseCreationType.MANUAL,
        isTriageAlert: false,
        creatorRole: role,
      });

      // Create "Complete New Case" task assigned to the creator
      // This task prompts the user to complete the missing case information
      // Task is created OUTSIDE transaction to avoid blocking the case creation
      const completeCaseTask = await this.taskService.createTask(
        {
          caseId: result.case.case_id,
          status: TaskStatus.STATUS_10_ASSIGNED, // Directly assigned to creator
          assignedUserId: userId,
          name: 'Complete New Case',
          description: 'Complete the draft case by providing all required information',
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        userId,
      );
      await this.flowableService.handleTaskAssigned({
        taskId: completeCaseTask.task_id,
        caseId: result.case.case_id,
        taskName: 'Complete New Case',
        assignedUserId: userId,
      });

      await this.auditLogService.logAction({
        userId,
        operation: 'saveCaseAsDraft',
        entityName: 'CaseCreation',
        actionPerformed: `Draft case ${result.case.case_id} created`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`Draft saved: case ${result.case.case_id}`, CaseCreationApprovalService.name);

      return {
        success: true,
        case: result.case,
        alert: result.alert,
        message: 'Case saved as draft.',
      };
    } catch (err) {
      this.logger.error('[DraftCase] Failed to save case as draft', { error: err, dto, userId, tenantId });

      // Log failure for audit trail
      await this.auditLogService.logAction({
        userId,
        operation: 'saveCaseAsDraft',
        entityName: 'CaseCreation',
        actionPerformed: `Failed: alert ${dto.alertId}`,
        outcome: Outcome.FAILURE,
      });

      throw new InternalServerErrorException(`Failed to save case as draft: ${err.message}`);
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

      const result = await this.caseRepository.executeTransaction(async (tx) => {
        const updatedCase = await this.caseRepository.updateCase(caseId, {
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        });
        await this.flowableService.handleCaseStatusChanged({
          caseId: caseId,
          newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          reason: 'Case creation approved by supervisor',
        });

        const completedApprovalTask = await tx.task.update({
          where: { task_id: approvalTask.task_id },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: supervisorId,
            updated_at: new Date(),
          },
        });
        await this.flowableService.handleTaskCompleted({
          caseId: caseId,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          taskName: 'Approve Case Creation',
          completionVariables: {
            creationApproval: 'approve',
            creationComments: 'Case creation approved by supervisor',
          },
        });

        return { case: updatedCase, approvedTask: completedApprovalTask };
      });

      // Create investigation task after approval
      this.logger.log(`[ApproveCaseCreation] Creating Investigation task for approved case ${caseId}`, CaseCreationApprovalService.name);
      const investigationTask = await this.taskService.createTask(
        {
          caseId: caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: TASK_NAMES.INVESTIGATE_CASE,
          description: `Investigate case: ${caseId}`,
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        supervisorId,
      );
      this.logger.log(
        `[ApproveCaseCreation] Investigation task ${investigationTask.task_id} created for case ${caseId}`,
        CaseCreationApprovalService.name,
      );

      await this.auditLogService.logAction({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Approved case creation for case ${caseId}. Investigation task ${investigationTask.task_id} created.`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `[ApproveCaseCreation] Case creation approved successfully for case ${caseId}. Investigation task ${investigationTask.task_id} created.`,
        CaseCreationApprovalService.name,
      );

      return {
        success: true,
        case: result.case,
        // approvedTask: result.approvedTask,
        // investigationTask: investigationTask,
        message: 'Case creation approved. Investigation task created.',
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

      const result = await this.caseRepository.executeTransaction(async (tx) => {
        const updatedCase = await this.caseRepository.updateCase(caseId, {
          status: CaseStatus.STATUS_00_DRAFT,
        });

        const approvalTask = await tx.task.findFirst({
          where: { case_id: caseId, name: 'Approve Case Creation', status: TaskStatus.STATUS_01_UNASSIGNED },
        });

        if (!approvalTask) throw new NotFoundException('Approve Case Creation task not found');

        await this.taskService.updateTask(
          approvalTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED, assignedUserId: supervisorId },
          supervisorId,
        );

        return { case: updatedCase, completedTask: approvalTask };
      });

      this.logger.log(
        `[REJECT_CASE_CREATION] Creating Complete New Case task for rejected case ${caseId}`,
        CaseCreationApprovalService.name,
      );
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
      this.logger.log(
        `[REJECT_CASE_CREATION] Complete New Case task ${completeNewCaseTask.task_id} created for case ${caseId}`,
        CaseCreationApprovalService.name,
      );

      await this.caseRepository.createComment({
        user_id: supervisorId,
        case_id: caseId,
        task_id: completeNewCaseTask.task_id,
        note: `Case creation rejected. Reason: ${reason}`,
      });

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_00_DRAFT,
        reason: `Case creation rejected: ${reason}`,
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
      const result = await this.caseRepository.executeTransaction(async (tx) => {
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
        );
        // Updated Implementation Might Need to Move
        await this.flowableService.handleTaskCompleted({
          caseId: updatedTask.case_id,
          taskName: updatedTask.name!,
          newStatus: updatedTask.status,
          completionVariables: {
            autoCloseEligible: false,
            casePriority: existingCase.priority!,
            readyForAssignment: 'true',
          },
        });
        return { case: updatedCase, completedTask: updatedTask };
      });

      const investigateTask = await this.taskService.createTask(
        {
          caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: TASK_NAMES.INVESTIGATE_CASE,
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

  async createCase(createCaseDTO: CreateCaseDto, userId: string) {
    try {
      this.logger.log(`Start - Create Case`, CaseCreationApprovalService.name);
      const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();
      const isTriageAlert = triageType === 'DISABLED' ? false : true;

      const createdCase = await this.caseRepository.createCase({
        tenantId: createCaseDTO.tenantId,
        caseCreatorUserId: createCaseDTO.caseCreatorUserId,
        caseOwnerUserId: createCaseDTO.caseOwnerUserId,
        status: createCaseDTO.status,
        priority: createCaseDTO.priority,
        parentId: createCaseDTO.parentId ?? null,
        caseType: createCaseDTO.caseType,
        caseCreationType: createCaseDTO.caseCreationType,
      });

      this.flowableService.handleCaseCreated({
        caseId: createdCase.case_id,
        tenantId: createdCase.tenant_id,
        caseStatus: createdCase.status,
        creationType: createCaseDTO.caseCreationType,
        isTriageAlert,
        creatorRole: 'SYSTEM',
      });

      this.logger.log(
        `[CaseWorkflow] Case ${createdCase.case_id} created with status ${createdCase.status}, emitting case.created event`,
        CaseCreationApprovalService.name,
      );
      await this.auditLogService.logAction({
        userId,
        operation: 'createCase',
        entityName: 'CaseCreationApprovalService',
        actionPerformed: `Case ${createdCase.case_id} created successfully`,
        outcome: Outcome.SUCCESS,
      });

      return createdCase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[CaseWorkflow] Error creating case: ${errorMessage}`, errorStack, CaseCreationApprovalService.name);
      throw error;
    }
  }

  async updateCaseStatus(caseId: string, status: CaseStatus, userId: string, priority?: Priority, caseType?: CaseType): Promise<Case> {
    this.logger.log(`Start - Update Case Status for case ${caseId} to status ${status}`, CaseCreationApprovalService.name);
    try {
      const updateData: Record<string, unknown> = {
        status,
        priority,
        case_type: caseType,
      };

      if (status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT) {
        await this.taskRepository.transaction(async (tx) => {
          // await this.flowableService.handleTaskCompleted({
          //   caseId,
          //   taskName: 'Complete New Case',
          //   newStatus: TaskStatus.STATUS_30_COMPLETED as string,
          //   completionVariables: {
          //     priority,
          //     readyForAssignment: 'true',
          //     assignToSelf: 'false',
          //   },
          // });

          await this.taskRepository.createTask(
            {
              case: {
                connect: { case_id: caseId },
              },
              name: TASK_NAMES.INVESTIGATE_CASE,
              description: `Investigate case: ${caseId}`,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            },
            tx,
          );
        });
      }

      const updatedCase = await this.caseRepository.updateCase(caseId, updateData);

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: status,
        reason: 'Case status updated',
      });

      await this.auditLogService.logAction({
        userId,
        operation: 'updateCaseStatus',
        entityName: 'CaseCreationApprovalService',
        actionPerformed: `Updated case ${caseId} status to ${status}`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(`End - Update Case Status for case ${caseId} to status ${status}`, CaseCreationApprovalService.name);
      return updatedCase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update case status for ${caseId}: ${errorMessage}`, errorStack, CaseCreationApprovalService.name);
      throw error;
    }
  }
}
