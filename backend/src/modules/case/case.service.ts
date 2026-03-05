import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from '../../../prisma/prisma.service';
import { Outcome } from '../../utils/types/outcome';
import { Alert, Case, CaseCreationType, CaseStatus, CaseType, Priority, Task, TaskStatus } from '@prisma/client-cms';
import { CaseQueryService } from './services/case-query.service';
import { TaskService } from '../../../src/modules/task/task.service';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { CommentService } from '../../../src/modules/comment/comment.service';
import { NotificationService } from '../notification/notification.service';
import { TASK_NAMES, CANDIDATE_GROUPS } from '../../constants/case.constants';
import { CaseReopeningService } from './services/case-reopening.service';
import { CaseClosureApprovalService } from './services/case-closure-approval.service';
import { CaseCreationApprovalService } from './services/case-creation-approval.service';
import { FlowableService } from '../../../src/modules/flowable/flowable.service';
import { AlertRepository } from '../repository/alert.repository';
import { CloseCaseDto, ManualCreateCaseDto, GetAllCasesQueryDto, GetUserCasesQueryDto, UpdateCaseDto } from './dto';
import { CacheService } from '../shared/cache.service';
import { CaseCreationService } from './services/case-creation.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { JsonValue } from '@prisma/client-cms/runtime/library';
import { setTimeout as delay } from 'node:timers/promises';

@Injectable()
export class CaseService {
  constructor(
    private readonly logger: LoggerService,
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
    private readonly caseCreationService: CaseCreationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async suspendCase(
    caseId: number,
    reason: string,
    tasksIds: number[],
    userId: string,
    tenantId: string,
    authDetails: any,
    role: string,
  ): Promise<{ success: boolean; case: Case; task: Task[] }> {
    const existingCase = await this.caseQueryService.retrieveCase(caseId, tenantId);
    if (existingCase === null) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (!role.toLowerCase().includes('supervisor')) {
      if (existingCase.case_owner_user_id !== userId) {
        throw new BadRequestException('Only Case owner can suspend a case');
      }
    }

    if (existingCase.status !== CaseStatus.STATUS_20_IN_PROGRESS) {
      throw new BadRequestException('Only cases in "IN PROGRESS" status can be suspended');
    }

    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for suspension is required');
    const allTasks = await this.taskService.getTasksByCaseId(existingCase.case_id, tenantId);
    const investigateTask = allTasks.filter((task) => tasksIds.includes(task.task_id));

    if (investigateTask.length === 0) throw new BadRequestException('No "Investigate Case" task found for this case');

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_21_SUSPENDED }, userId);

        if (updatedCase.parent_id) {
          const subCase = await prisma.case.findFirst({
            where: {
              parent_id: updatedCase.parent_id,
              tenant_id: updatedCase.tenant_id,
              NOT: {
                case_id: updatedCase.case_id,
              },
            },
          });

          if (updatedCase.status === CaseStatus.STATUS_21_SUSPENDED && subCase?.status === CaseStatus.STATUS_21_SUSPENDED) {
            await prisma.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_21_SUSPENDED, updated_at: new Date() },
            });
          }
        }
        const updatedTask = await Promise.all(
          investigateTask.map(
            async (task) => await this.taskService.updateTask(task.task_id, { status: TaskStatus.STATUS_21_BLOCKED }, userId, tenantId),
          ),
        );
        const createCommentDto = new CreateCommentDto();
        createCommentDto.caseId = updatedCase.case_id;
        createCommentDto.note = `Case suspended: ${reason}`;
        createCommentDto.tenantId = tenantId;
        await this.commentService.addComment(createCommentDto, userId);

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'suspendCase',
            entityName: CaseService.name,
            actionPerformed: `Suspend case ${caseId}`,
            outcome: Outcome.SUCCESS,
          },
          caseId,
          updatedCase.tenant_id,
        );

        return { case: updatedCase, task: updatedTask };
      });

      await delay(1000);

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_21_SUSPENDED,
      });

      try {
        const caseAssignee = investigateTask.map((t) => t.assigned_user_id?.trim()).filter((id): id is string => !!id);
        this.logger.error(`caseAssignee : ${JSON.stringify(caseAssignee)}`);
        if (caseAssignee.length > 0) {
          const suspendedBy = await this.cacheService.getUserFromCache(userId);
          await Promise.all(
            caseAssignee.map(async (id) => {
              await this.notificationService.sendNotification({
                userId: id,
                type: 'CASE_SUSPENDED',
                message: `Case ${caseId} has been suspended by ${Array.isArray(caseAssignee) ? caseAssignee.join(', ') : caseAssignee}`,
                metadata: {
                  caseId,
                  actionBy: suspendedBy?.username ?? suspendedBy?.fullName,
                  reason,
                },
              });
            }),
          );
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send suspension notification for case ${caseId}: ${notificationError}`);
      }
      return { success: true, ...result };
    } catch (err) {
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'suspendCase',
        entityName: CaseService.name,
        actionPerformed: `Attempted to suspend case ${caseId}`,
        outcome: Outcome.FAILURE,
      });
      this.logger.error('suspendCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to suspend case: ${err}`);
    }
  }

  async resumeCase(
    caseId: number,
    reason: string,
    userId: string,
    tenantId: string,
    authDetails: any,
  ): Promise<{ success: boolean; case: Case; task: Task[] }> {
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for resumption is required');

    const existingCase = await this.caseQueryService.retrieveCase(caseId, tenantId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.case_owner_user_id !== userId) throw new BadRequestException('Only Case owner can resume a case');

    if (existingCase.status !== CaseStatus.STATUS_21_SUSPENDED) throw new BadRequestException('Only suspended cases can be resumed');

    const allTasks = await this.taskService.getTasksByCaseId(existingCase.case_id, tenantId);
    this.logger.error(`All Tasks: ${JSON.stringify(allTasks)}`);
    // const investigateTask = allTasks.find((t) => t.name === (TASK_NAMES.INVESTIGATE_CASE || TASK_NAMES.INVESTIGATE_AML ||TASK_NAMES.INVESTIGATE_FRAUD));
    const investigateTask = allTasks.filter(
      (t) =>
        t.name !== null &&
        (t.name === TASK_NAMES.INVESTIGATE_CASE || t.name === TASK_NAMES.INVESTIGATE_AML || t.name === TASK_NAMES.INVESTIGATE_FRAUD) &&
        t.status === TaskStatus.STATUS_21_BLOCKED,
    );
    this.logger.error(`investigateTask: ${JSON.stringify(investigateTask)}`);
    if (investigateTask.length === 0) throw new BadRequestException('No "Investigate case" task found for this case');

    try {
      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_20_IN_PROGRESS,
      });

      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_20_IN_PROGRESS }, userId);
        if (updatedCase.parent_id) {
          const subCase = await prisma.case.findFirst({
            where: {
              parent_id: updatedCase.parent_id,
              tenant_id: updatedCase.tenant_id,
              NOT: {
                case_id: updatedCase.case_id,
              },
            },
          });

          if (updatedCase.status === CaseStatus.STATUS_20_IN_PROGRESS && subCase?.status === CaseStatus.STATUS_21_SUSPENDED) {
            await prisma.case.update({
              where: { case_id: updatedCase.parent_id },
              data: { status: CaseStatus.STATUS_20_IN_PROGRESS, updated_at: new Date() },
            });
          }
        }

        const updatedTask = await Promise.all(
          investigateTask.map(
            async (t) => await this.taskService.updateTask(t.task_id, { status: TaskStatus.STATUS_20_IN_PROGRESS }, userId, tenantId),
          ),
        );
        const createCommentDto = new CreateCommentDto();
        createCommentDto.caseId = caseId;
        createCommentDto.note = `Case resumed: ${reason}`;
        createCommentDto.tenantId = tenantId;
        await this.commentService.addComment(createCommentDto, userId);

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'resumeCase',
            entityName: CaseService.name,
            actionPerformed: `Resume case ${caseId}`,
            outcome: Outcome.SUCCESS,
          },
          caseId,
          updatedCase.tenant_id,
        );

        return { case: updatedCase, task: updatedTask };
      });

      try {
        // const caseAssignee = investigateTask.assigned_user_id;
        const caseAssignee = investigateTask.map((t) => t.assigned_user_id?.trim()).filter((id): id is string => !!id);
        this.logger.error(`caseAssignee : ${JSON.stringify(caseAssignee)}`);
        if (caseAssignee.length > 0) {
          const resumedBy = await this.cacheService.getUserFromCache(userId);
          await Promise.all(
            caseAssignee.map(async (id) => {
              await this.notificationService.sendNotification({
                userId: id,
                type: 'CASE_RESUMED',
                message: `Case ${caseId} has been resumed by ${Array.isArray(caseAssignee) ? caseAssignee.join(', ') : caseAssignee}`,
                metadata: {
                  caseId,
                  actionBy: resumedBy?.username ?? resumedBy?.email,
                  reason,
                },
              });
            }),
          );
        }
      } catch (notificationError) {
        this.logger.warn(`Failed to send resumption notification for case ${caseId}: ${notificationError}`);
      }

      return { success: true, ...result };
    } catch (err) {
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'resumeCase',
        entityName: CaseService.name,
        actionPerformed: `Attempted to resume case ${caseId}`,
        outcome: Outcome.FAILURE,
      });

      this.logger.error('resumeCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to resume case: ${err}`);
    }
  }

  async abandonCase(
    caseId: number,
    reason: string,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; case: Case; task: Task }> {
    if (!reason || reason.trim() === '') throw new BadRequestException('Reason for abandonment is required');
    const existingCase = await this.caseQueryService.retrieveCase(caseId, tenantId);
    if (!existingCase) throw new BadRequestException(`Case doesn't exist for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Cannot abandon case other than draft status');

    const allTasks = await this.taskService.getTasksByCaseId(existingCase.case_id, tenantId);
    const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');
    if (!completeNewCaseTask) throw new BadRequestException('No complete new Case Task exists');
    if (completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
      throw new BadRequestException(`Cannot update Complete New Case task ${completeNewCaseTask.task_id} as it is already completed`);
    }
    this.logger.log(`Abandoning case ${caseId} with userId: ${userId}`, CaseService.name);
    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_99_ABANDONED }, userId);
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
          tenantId,
        );
        const createCommentDto = new CreateCommentDto();
        //createCommentDto.taskId = updatedTask.task_id;
        createCommentDto.note = reason;
        createCommentDto.caseId = caseId;
        createCommentDto.tenantId = tenantId;
        this.commentService.addComment(createCommentDto, userId);

        this.flowableService.handleCaseAbandoned({ caseId, reason });

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId,
            operation: 'abandonCase',
            entityName: CaseService.name,
            actionPerformed: `Abandon case ${caseId}`,
            outcome: Outcome.SUCCESS,
          },
          caseId,
          updatedCase.tenant_id,
        );

        return { case: updatedCase, task: updatedTask };
      });

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('abandonCase failed', { error: err, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to abandon case : ${err}`);
    }
  }

  async saveCaseAsDraft(
    dto: ManualCreateCaseDto,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ success: boolean; case?: Case; alert?: Alert; message: string }> {
    return await this.caseCreationApprovalService.saveCaseAsDraft(dto, userId, tenantId, role);
  }

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
    return await this.caseReopeningService.reopenCase(caseId, reason, userId, tenantId, role);
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
    return await this.caseReopeningService.approveCaseReopening(caseId, supervisorId, tenantId);
  }

  async rejectCaseReopening(
    caseId: number,
    rejectionReason: string,
    supervisorId: string,
    tenantId: string,
  ): Promise<{
    success: boolean;
    message: string;
    case: {
      case_id: number;
      status: CaseStatus;
      updated_at: Date;
    };
    completed_task: {
      task_id: number;
      status: TaskStatus;
    };
    rejection_reason: string;
  }> {
    return await this.caseReopeningService.rejectCaseReopening(caseId, rejectionReason, supervisorId, tenantId);
  }

  async closeCase(
    caseId: number,
    dto: CloseCaseDto,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ message: string; closed_case: { case_id: number; status: string; updated_at: Date }; supervisor_closure?: boolean }> {
    return await this.caseClosureApprovalService.closeCase(caseId, dto, userId, tenantId, role);
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
    return await this.caseClosureApprovalService.approveCaseClosure(caseId, finalOutcome, comments, supervisorId, tenantId);
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
    return await this.caseClosureApprovalService.rejectCaseClosure(caseId, comments, supervisorId, tenantId);
  }

  async returnCaseForReview(
    caseId: number,
    comments: string,
    supervisorId: string,
    tenantId: string,
  ): Promise<{
    message: string;
    case: { case_id: number; status: string; updated_at: Date };
  }> {
    return await this.caseClosureApprovalService.returnCaseForReview(caseId, comments, supervisorId, tenantId);
  }

  async approveCaseCreation(
    caseId: number,
    supervisorId: string,
    tenantId: string,
  ): Promise<{ success: boolean; case: Case; message: string }> {
    return await this.caseCreationApprovalService.approveCaseCreation(caseId, supervisorId, tenantId);
  }

  async rejectCaseCreation(
    caseId: number,
    supervisorId: string,
    tenantId: string,
    reason: string,
  ): Promise<{
    success: boolean;
    case: Case;
    completedTask: Task;
    newTask: Task;
  }> {
    return await this.caseCreationApprovalService.rejectCaseCreation(caseId, supervisorId, tenantId, reason);
  }

  async completeCase(
    caseId: number,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; case: Case; completedTask: Task; newTask: Task }> {
    return await this.caseCreationApprovalService.completeCase(caseId, userId, tenantId);
  }

  async getAllCases(
    query: GetAllCasesQueryDto,
    tenantId: string,
    investigatorUserId?: string,
    isComplianceOfficer?: boolean,
  ): Promise<{
    cases: Array<{
      case_id: number;
      tenant_id: string;
      case_creator_user_id: string;
      case_owner_user_id: string | null;
      status: CaseStatus;
      priority: Priority;
      case_type: CaseType | null;
      created_at: Date;
      updated_at: Date;
      total_tasks: number;
      tasks: Array<{
        name: string | null;
        status: TaskStatus;
        created_at: Date;
        task_id: number;
        assigned_user_id: string | null;
      }>;
      completed_tasks: number;
      pending_tasks: number;
      alert: {
        alert_id: number;
        alert_type: CaseType | null;
        message: string;
        transaction: JsonValue;
        confidence_per: number;
      } | null;
      parent_id: number | null;
      assigned_to:
        | {
            user_id: string | null;
            task_count: number;
          }
        | undefined;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    statistics: {
      totalCases: number;
      casesByStatus: Record<string, number>;
      casesByPriority: Record<string, number>;
      casesByType: Record<string, number>;
      unassignedCases: number;
      averageTasksPerCase: number;
      oldestUnassignedCase:
        | {
            case_id: number;
            created_at: Date;
            days_old: number;
          }
        | undefined;
    };
  }> {
    return await this.caseQueryService.getAllCases(query, tenantId, investigatorUserId, isComplianceOfficer);
  }

  async getUserCases(
    userId: string,
    query: GetUserCasesQueryDto,
    isComplianceOfficer?: boolean,
  ): Promise<{
    cases: Array<{
      case_id: number;
      status: CaseStatus;
      priority: Priority;
      case_type: CaseType | null;
      created_at: Date;
      updated_at: Date;
      user_role: 'owner' | 'task_assignee' | 'both';
      user_tasks: Array<{
        task_id: number;
        name: string | null;
        status: TaskStatus;
        created_at: Date | undefined;
      }>;
      total_tasks: number;
      alert:
        | {
            alert_id: number;
            message: string;
            confidence_per: number;
            transaction: JsonValue;
          }
        | undefined;
      latest_comment_date: Date;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    summary: {
      totalOwnedCases: number;
      totalTaskAssignments: number;
      casesByStatus: Record<string, number>;
      casesByPriority: Record<string, number>;
    };
  }> {
    return await this.caseQueryService.getUserCases(userId, query, isComplianceOfficer);
  }

  async getUserWorkloadStats(
    userId: string,
    isComplianceOfficer?: boolean,
  ): Promise<{
    totalActiveCases: number;
    totalPendingTasks: number;
    casesByStatus: Record<string, number>;
    casesByPriority: Record<string, number>;
    oldestCase: {
      case_id: number;
      created_at: Date;
      days_old: number;
    } | null;
    averageCaseAge: number;
    upcomingTasks: Array<{
      task_id: number;
      name: string | null;
      case_id: number;
      days_old: number;
    }>;
  }> {
    return await this.caseQueryService.getUserWorkloadStats(userId, isComplianceOfficer);
  }

  async updateCase(caseId: number, updateData: Partial<UpdateCaseDto>, userId: string): Promise<Case> {
    return await this.caseQueryService.updateCase(caseId, updateData, userId);
  }

  async completeCaseCreation(
    caseId: number,
    updateData: Partial<UpdateCaseDto>,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ success: boolean; case: Case; completedTask: Task; message: string; requiresApproval: boolean }> {
    const existingCase = await this.caseQueryService.retrieveCase(caseId, tenantId);
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
        });

        const allTasks = await this.taskService.getTasksByCaseId(existingCase.case_id, tenantId);
        const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');

        if (!completeNewCaseTask) {
          throw new BadRequestException('No Complete New Case task found');
        }

        if (completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
          throw new BadRequestException(`Complete New Case task ${completeNewCaseTask.task_id} is already completed`);
        }
        const completedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          {
            status: TaskStatus.STATUS_30_COMPLETED,
            assignedUserId: userId,
          },
          userId,
          tenantId,
        );
        const isAutoCloseEligible =
          targetStatus === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT || targetStatus === CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL
            ? false
            : true;
        await this.flowableService.handleTaskCompleted({
          caseId: completedTask.case_id,
          taskName: completedTask.name!,
          newStatus: TaskStatus.STATUS_30_COMPLETED,
          completionVariables: {
            autoCloseEligible: isAutoCloseEligible,
            caseType: updateData.caseType ?? existingCase.case_type!,
            casePriority: updateData.priority ?? existingCase.priority,
            draftApprovalRequired: isSupervisor ? false : true,
          },
        });

        const createCommentDto = new CreateCommentDto();
        createCommentDto.caseId = caseId;
        createCommentDto.taskId = completeNewCaseTask.task_id;
        createCommentDto.note = updateData.note ?? 'Completed case creation';
        createCommentDto.tenantId = tenantId;

        await this.commentService.addComment(createCommentDto, userId);
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
          tenantId,
        );

        this.logger.log(`[CompleteCaseCreation] Approval task ${nextTask.task_id} created for supervisor review`, CaseService.name);
      } else if (result.case.case_type === CaseType.FRAUD_AND_AML) {
        // Supervisor: Create investigation task directly

        await this.caseCreationService.createCaseWithInvestigationTask(
          CaseType.FRAUD,
          userId,
          existingCase.tenant_id,
          caseId,
          result.case.priority,
          CaseCreationType.AUTOMATIC_SYSTEM,
          role,
        );
        await this.caseCreationService.createCaseWithInvestigationTask(
          CaseType.AML,
          userId,
          existingCase.tenant_id,
          caseId,
          result.case.priority,
          CaseCreationType.AUTOMATIC_SYSTEM,
          role,
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
          tenantId,
        );
      }

      // this.logger.log(
      //   `[CompleteCaseCreation] Investigation task ${nextTask.task_id} created (auto-approved by supervisor)`,
      //   CaseService.name,
      // );

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

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'completeCaseCreation',
          entityName: CaseService.name,
          actionPerformed: `Completed draft case ${caseId} by ${role}${needsApproval ? ', created approval task' : ', created investigation task'}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
        existingCase.tenant_id,
      );

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

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'completeCaseCreation',
        entityName: CaseService.name,
        actionPerformed: `Failed to complete draft case ${caseId}: ${err}`,
        outcome: Outcome.FAILURE,
      });

      throw new InternalServerErrorException(`Failed to complete case creation: ${err}`);
    }
  }

  async retrieveCase(caseId: number, tenantId: string, isComplianceOfficer?: boolean): Promise<Case | null> {
    return await this.caseQueryService.retrieveCase(caseId, tenantId, isComplianceOfficer);
  }

  async getSubCasesDetails(caseId: number): Promise<Case[]> {
    return await this.caseQueryService.getSubCasesDetails(caseId);
  }
}
