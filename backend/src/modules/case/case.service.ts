import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from '../../../prisma/prisma.service';
import { Outcome } from '../audit/types/outcome';
import { AuditLogService } from '../../../src/modules/audit/auditLog.service';
import { CaseStatus, CaseType, TaskStatus } from '@prisma/client';
import { CaseQueryService } from './services/case-query.service';
import { TaskService } from '../../../src/modules/task/task.service';
import { CreateCommentDto } from '../../../src/modules/comment/dto/create-comment.dto';
import { CommentService } from '../../../src/modules/comment/comment.service';
import { NotificationService } from '../notification/notification.service';
import { AuthHelperService } from '../../../src/modules/auth/auth-helper.service';
import { TASK_NAMES, CANDIDATE_GROUPS } from './utils/constants/case.constants';
import { CaseReopeningService } from './services/case-reopening.service';
import { CaseClosureApprovalService } from './services/case-closure-approval.service';
import { CaseCreationApprovalService } from './services/case-creation-approval.service';
import { FlowableService } from '../../../src/modules/flowable/flowable.service';
import { AlertRepository } from '../repository/alert.repository';
import {
  CloseCaseDto,
  SystemCaseCreationDto,
  ManualCreateCaseDto,
  GetAllCasesQueryDto,
  GetUserCasesQueryDto,
  UpdateCaseDto,
} from './dto/index.dto';
import { UserService } from '../user/user.service';
import { CacheService } from '../shared/cache.service';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly prismaService: PrismaService,
    private readonly taskService: TaskService,
    private readonly commentService: CommentService,
    private readonly notificationService: NotificationService,
    private readonly cacheService: CacheService,
    private readonly caseQueryService: CaseQueryService,
    private readonly caseReopeningService: CaseReopeningService,
    private readonly caseClosureApprovalService: CaseClosureApprovalService,
    private readonly caseCreationApprovalService: CaseCreationApprovalService,
    private readonly flowableService: FlowableService,
    private readonly alertRepository: AlertRepository,
    private readonly userService: UserService,
  ) { }

  async suspendCase(caseId: string, reason: string, userId: string, tenantId: string, authDetails: any) {
    const existingCase = await this.caseQueryService.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can suspend a case');

    if (existingCase.status !== CaseStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException('Only cases in "IN PROGRESS" status can be suspended');

    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for suspension is required');
    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    // const investigateTask = allTasks.find(
    //   (t) => t.name === TASK_NAMES.INVESTIGATE_CASE || t.name === TASK_NAMES.INVESTIGATE_FRAUD || t.name === TASK_NAMES.INVESTIGATE_AML,
    // );
    const investigateTask = allTasks
      .filter(
        (t) => t.name === TASK_NAMES.INVESTIGATE_CASE || t.name === TASK_NAMES.INVESTIGATE_FRAUD || t.name === TASK_NAMES.INVESTIGATE_AML,
      )
      .find((t) => (t.status = TaskStatus.STATUS_20_IN_PROGRESS));

    if (!investigateTask) throw new BadRequestException('No "Investigate Case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_20_IN_PROGRESS)
      throw new BadRequestException(`Cannot suspend as Investigate case task ${investigateTask.task_id} is not in progress`);

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_21_SUSPENDED }, userId);

        const updatedTask = await this.taskService.updateTask(investigateTask.task_id, { status: TaskStatus.STATUS_21_BLOCKED }, userId);

        const createCommentDto = new CreateCommentDto();
        //  createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.caseId = updatedCase.case_id;
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

      this.flowableService.handleCaseStatusChanged({
        caseId: caseId,
        newStatus: CaseStatus.STATUS_21_SUSPENDED,
        reason: `Case suspended: ${reason}`,
      });

      try {
        const caseAssignee = investigateTask.assigned_user_id;
        if (caseAssignee) {
          const suspendedBy = await this.cacheService.getUserFromCache(userId);
          await this.notificationService.sendNotification({
            userId: caseAssignee,
            type: 'CASE_SUSPENDED',
            message: `Case ${caseId} has been suspended by ${caseAssignee}`,
            metadata: {
              caseId,
              actionBy: suspendedBy?.username || suspendedBy?.fullName,
              reason,
            },
          })
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

  async resumeCase(caseId: string, reason: string, userId: string, tenantId: string, authDetails: any) {
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for resumption is required');

    const existingCase = await this.caseQueryService.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can resume a case');

    if (existingCase.status !== CaseStatus.STATUS_21_SUSPENDED) throw new BadRequestException('Only suspended cases can be resumed');

    const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
    const investigateTask = allTasks.find((t) => t.name === TASK_NAMES.INVESTIGATE_CASE);

    if (!investigateTask) throw new BadRequestException('No "Investigate case" task found for this case');

    if (investigateTask.status !== TaskStatus.STATUS_21_BLOCKED)
      throw new BadRequestException(`Cannot resume as Investigate case task ${investigateTask.task_id} is not blocked`);

    try {
      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_20_IN_PROGRESS,
        reason: `Case resumed: ${reason}`,
      });

      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_20_IN_PROGRESS }, userId);
        const updatedTask = await this.taskService.updateTask(
          investigateTask.task_id,
          { status: TaskStatus.STATUS_20_IN_PROGRESS },
          userId,
        );

        const createCommentDto = new CreateCommentDto();
        // createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.caseId = caseId;
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
          const resumedBy = await this.cacheService.getUserFromCache(userId);
          await this.notificationService.sendNotification({
            userId: caseAssignee,
            type: 'CASE_RESUMED',
            message: `Case ${caseId} has been resumed by ${caseAssignee}`,
            metadata: {
              caseId,
              resumedBy: resumedBy?.username || resumedBy?.email,
              reason,
            },
          })
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
    const existingCase = await this.caseQueryService.retrieveCase(caseId);
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
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_99_ABANDONED }, userId);
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
        );
        const createCommentDto = new CreateCommentDto();
        //createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = reason;
        createCommentDto.caseId = caseId;
        this.commentService.addComment(createCommentDto, userId);

        this.flowableService.handleCaseAbandoned({ caseId, reason });

        await this.auditLogService.logAction({
          userId,
          operation: 'abandonCase',
          entityName: CaseService.name,
          actionPerformed: `Abandon case ${caseId}`,
          outcome: Outcome.SUCCESS,
        });

        return { case: updatedCase, task: updatedTask };
      });

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('abandonCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to abandon case : ${err.message}`);
    }
  }

  async saveCaseAsDraft(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    return this.caseCreationApprovalService.saveCaseAsDraft(dto, userId, tenantId, role);
  }

  async reopenCase(caseId: string, reason: string, userId: string, tenantId: string, role: string) {
    return this.caseReopeningService.reopenCase(caseId, reason, userId, tenantId, role);
  }

  async approveCaseReopening(caseId: string, supervisorId: string, tenantId: string) {
    return this.caseReopeningService.approveCaseReopening(caseId, supervisorId, tenantId);
  }

  async rejectCaseReopening(caseId: string, rejectionReason: string, supervisorId: string, tenantId: string) {
    return this.caseReopeningService.rejectCaseReopening(caseId, rejectionReason, supervisorId, tenantId);
  }

  async closeCase(caseId: string, dto: CloseCaseDto, userId: string, tenantId: string, role: string) {
    return this.caseClosureApprovalService.closeCase(caseId, dto, userId, tenantId, role);
  }

  async approveCaseClosure(caseId: string, finalOutcome: string, comments: string, supervisorId: string) {
    return this.caseClosureApprovalService.approveCaseClosure(caseId, finalOutcome, comments, supervisorId);
  }

  async rejectCaseClosure(caseId: string, comments: string, supervisorId: string) {
    return this.caseClosureApprovalService.rejectCaseClosure(caseId, comments, supervisorId);
  }

  async returnCaseForReview(caseId: string, comments: string, supervisorId: string) {
    return this.caseClosureApprovalService.returnCaseForReview(caseId, comments, supervisorId);
  }

  async manualCaseCreate(dto: ManualCreateCaseDto, userId: string, tenantId: string, role: string) {
    return this.caseCreationApprovalService.manualCaseCreate(dto, userId, tenantId, role);
  }
  async approveCaseCreation(caseId: string, supervisorId: string, tenantId: string) {
    return this.caseCreationApprovalService.approveCaseCreation(caseId, supervisorId, tenantId);
  }

  async rejectCaseCreation(caseId: string, supervisorId: string, tenantId: string, reason: string) {
    return this.caseCreationApprovalService.rejectCaseCreation(caseId, supervisorId, tenantId, reason);
  }

  async completeCase(caseId: string, userId: string, tenantId: string) {
    return this.caseCreationApprovalService.completeCase(caseId, userId, tenantId);
  }

  async getAllCases(query: GetAllCasesQueryDto, tenantId: string, investigatorUserId?: string) {
    return this.caseQueryService.getAllCases(query, tenantId, investigatorUserId);
  }

  async getUserCases(userId: string, query: GetUserCasesQueryDto) {
    return this.caseQueryService.getUserCases(userId, query);
  }

  async getUserWorkloadStats(userId: string) {
    return this.caseQueryService.getUserWorkloadStats(userId);
  }

  async updateCase(caseId: string, updateData: Partial<UpdateCaseDto>, userId: string) {
    return this.caseQueryService.updateCase(caseId, updateData, userId);
  }

  async completeCaseCreation(caseId: string, updateData: Partial<UpdateCaseDto>, userId: string, role: string) {
    const existingCase = await this.caseQueryService.retrieveCase(caseId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);

    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) {
      throw new BadRequestException('Only cases in DRAFT status can be completed');
    }

    // Validate required fields are provided
    const missingFields: string[] = [];
    if (!updateData.priority && !existingCase.priority) missingFields.push('priority');
    if (!updateData.caseType && !existingCase.case_type) missingFields.push('caseType');

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Missing required fields to complete case creation',
        missingFields,
      });
    }

    const isSupervisor = role === 'SUPERVISOR';
    const needsApproval = !isSupervisor;

    // Determine the target status based on role
    const targetStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;

    this.logger.log(
      `[CompleteCaseCreation] Completing draft case ${caseId} by ${role}. Will ${needsApproval ? 'require approval' : 'be auto-approved'}`,
      CaseService.name,
    );

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        // Update case with provided data and new status
        const updatedCase = await this.caseQueryService.updateCase(caseId, { ...updateData, status: targetStatus }, userId);
        await this.flowableService.handleCaseStatusChanged({
          caseId,
          newStatus: targetStatus,
          reason: `Case creation completed by ${role}`,
        });

        // Find and complete the "Complete New Case" task
        const allTasks = (await this.taskService.getTasksByCaseId(existingCase.case_id)) ?? [];
        const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');

        if (!completeNewCaseTask) {
          throw new BadRequestException('No Complete New Case task found');
        }

        if (completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
          throw new BadRequestException(`Complete New Case task ${completeNewCaseTask.task_id} is already completed`);
        }

        const completedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
        );
        await this.flowableService.handleTaskCompleted({
          caseId: completedTask.case_id,
          taskName: completedTask.name!,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            autoCloseEligible: targetStatus === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT ? false : true,
            caseType: updateData.caseType || existingCase.case_type!,
            casePriority: updateData.priority || existingCase.priority!,
            readyForAssignment: targetStatus === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT ? true : false,
          },
        });

        await this.commentService.addComment(
          { caseId: caseId, taskId: completeNewCaseTask.task_id, note: updateData.note } as CreateCommentDto,
          userId,
        );
        return { case: updatedCase, completedTask };
      });

      this.logger.log(
        `[CompleteCaseCreation] Case ${caseId} updated to ${targetStatus}, Complete New Case task completed`,
        CaseService.name,
      );

      // Create appropriate next task based on role
      let nextTask;
      if (needsApproval) {
        // Investigator/Analyst: Create approval task for supervisor
        nextTask = await this.taskService.createTask(
          {
            caseId,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: TASK_NAMES.APPROVE_CASE_CREATION,
            description: `Review and approve case creation for case ${caseId}`,
            candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
          },
          userId,
        );

        this.logger.log(`[CompleteCaseCreation] Approval task ${nextTask.task_id} created for supervisor review`, CaseService.name);
      } else {
        // Supervisor: Create investigation task directly
        if (result.case.case_type === CaseType.FRAUD_AND_AML) {
          const fraudInvestigationTask = await this.taskService.createTask(
            {
              caseId,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: TASK_NAMES.INVESTIGATE_FRAUD,
              description: `Task to investigate fraud: ${caseId}`,
              candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            },
            userId,
          );

          const amlInvestigationTask = await this.taskService.createTask(
            {
              caseId,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: TASK_NAMES.INVESTIGATE_AML,
              description: `Task to investigate AML: ${caseId}`,
              candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            },
            userId,
          );
        } else {
          nextTask = await this.taskService.createTask(
            {
              caseId,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: TASK_NAMES.INVESTIGATE_CASE,
              description: `Task to investigate: ${caseId}`,
              candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            },
            userId,
          );
        }

        // this.logger.log(
        //   `[CompleteCaseCreation] Investigation task ${nextTask.task_id} created (auto-approved by supervisor)`,
        //   CaseService.name,
        // );
      }

      const getAlertIdByCaseId = await this.alertRepository.getAlertByCaseId(caseId);
      if (getAlertIdByCaseId) {
        const alertUpdateData = {
          priority_score: updateData.priorityScore,
          priority: updateData.priority,
          alertType: updateData.caseType,
          predictionOutcome: updateData.predictionOutcome,
          confidencePer: updateData.confidence,
          case_id: caseId,
        };
        await this.alertRepository.updateAlert(getAlertIdByCaseId, alertUpdateData);
        this.logger.log(`[CompleteCaseCreation] Alert ${getAlertIdByCaseId} updated with case ID ${caseId}`, CaseService.name);
      }

      await this.auditLogService.logAction({
        userId,
        operation: 'completeCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Completed draft case ${caseId} by ${role}${needsApproval ? ', created approval task' : ', created investigation task'}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        success: true,
        case: result.case,
        completedTask: result.completedTask,
        // nextTask,
        message: needsApproval
          ? 'Case creation completed and pending supervisor approval'
          : 'Case creation completed and ready for investigation',
        requiresApproval: needsApproval,
      };
    } catch (err) {
      this.logger.error('completeCaseCreation failed', { error: err, caseId, userId, role });

      await this.auditLogService.logAction({
        userId,
        operation: 'completeCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Failed to complete draft case ${caseId}: ${err.message}`,
        outcome: Outcome.FAILURE,
      });

      throw new InternalServerErrorException(`Failed to complete case creation: ${err.message}`);
    }
  }
  async retrieveCase(caseId: string) {
    return this.caseQueryService.retrieveCase(caseId);
  }
}
