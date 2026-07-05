import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../../utils/types/outcome';
import { CaseStatus, TaskStatus, CaseType, CaseCreationType, Priority, Case, Alert, Task } from '@prisma/client-cms';
import { ManualCreateCaseDto, CreateCaseDto } from '../dto';
import { TaskService } from 'src/modules/task/task.service';
import { TASK_NAMES, CANDIDATE_GROUPS, CLOSED_CASE_STATUSES } from '../../../constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { CasePriorityUtil } from '../../shared/utils/case-priority.util';
import { CaseQueryService } from './case-query.service';
import { FlowableService } from '../..//flowable/flowable.service';
import { TaskRepository } from 'src/modules/repository/task.repository';
import { CommentRepository } from 'src/modules/repository/comment.repository';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { InvestigationGroupService } from 'src/modules/investigation-group/investigation-group.service';
import { AlertRepository } from 'src/modules/repository/alert.repository';

@Injectable()
export class CaseCreationApprovalService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly taskService: TaskService,
    private readonly taskRepository: TaskRepository,
    private readonly caseRepository: CaseRepository,
    private readonly commentRepository: CommentRepository,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly flowableService: FlowableService,
    private readonly caseQueryService: CaseQueryService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly investigationGroupService: InvestigationGroupService,
    private readonly alertRepository: AlertRepository,
  ) {}

  private validateCaseCompletionFields(existingCase: any): string[] {
    const missing: string[] = [];
    if (!existingCase.priority) missing.push('priority');
    if (!existingCase.case_type) missing.push('case_type');
    return missing;
  }

  async saveCaseAsDraft(
    dto: ManualCreateCaseDto,
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<{ success: boolean; case?: Case; alert?: Alert; message: string }> {
    this.loggerService.log('Start - Save As Draft', CaseCreationApprovalService.name);

    const existingAlert = await this.caseRepository.findAlert(dto.alertId, tenantId);

    if (!existingAlert) {
      throw new BadRequestException('Alert Not Found');
    }

    if (existingAlert.case_id ?? (existingAlert.alert_data as any)?.status !== 'NALT') {
      throw new BadRequestException(
        existingAlert.case_id
          ? `Case already exists for alertId ${dto.alertId}`
          : 'Can only create manual cases from alerts with NALT status',
      );
    }

    const { priorityScore } = dto;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = (CaseType as Record<string, CaseType>)[dto.alertType] ?? null;

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
        creatorRole: role,
        isReopened: false,
        // isFraudNAML routes the BPMN process straight to "Investigate Case", skipping
        // "Complete New Case"/"Approve Case Creation" - that's only correct for the
        // already-split single-type (FRAUD/AML) sibling cases, not this FRAUD_AND_AML
        // draft, which still needs to go through the full draft/approval flow.
        isFraudNAML: false,
      });

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
        tenantId,
      );
      await this.flowableService.handleTaskAssigned({
        taskId: completeCaseTask.task_id,
        caseId: result.case.case_id,
        taskName: 'Complete New Case',
        assignedUserId: userId,
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'saveCaseAsDraft',
          entityName: 'CaseCreation',
          actionPerformed: `Draft case ${result.case.case_id} created`,
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        result.case.case_id,
        tenantId,
      );
      this.loggerService.log(`Draft saved: case ${result.case.case_id}`, CaseCreationApprovalService.name);

      return {
        success: true,
        case: result.case,
        alert: result.alert,
        message: 'Case saved as draft.',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      this.loggerService.error('[DraftCase] Failed to save case as draft', {
        error: errorMessage,
        stack: errorStack,
        dto,
        userId,
        tenantId,
      });

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'saveCaseAsDraft',
        entityName: 'CaseCreation',
        actionPerformed: `Failed: alert ${dto.alertId}`,
        outcome: Outcome.FAILURE,
        tenantId,
      });

      throw new InternalServerErrorException(`Failed to save case as draft: ${errorMessage}`);
    }
  }

  async approveCaseCreation(
    caseId: number,
    supervisorId: string,
    tenantId: string,
  ): Promise<{ success: boolean; case: Case; message: string }> {
    try {
      this.loggerService.log('Start - Approve Case Creation', CaseCreationApprovalService.name);
      const { approvalTask } = await this.validateCaseCreationApprovalPreconditions(caseId, tenantId);

      const txResult = await this.caseRepository.transaction(async (tx) => {
        const updatedCase = await this.caseRepository.updateCase(caseId, {
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
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

      await this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });

      await this.flowableService.handleTaskCompleted({
        caseId,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        taskName: 'Approve Case Creation',
        completionVariables: {
          creationApproval: 'approve',
          creationComments: 'Case creation approved by supervisor',
        },
      });

      let finalCase = txResult.case;

      if (txResult.case.case_type === CaseType.FRAUD_AND_AML) {
        // FRAUD_AND_AML splits into two sibling cases sharing an InvestigationGroup:
        // the already-approved case becomes the FRAUD case, and a new AML case is
        // created alongside it with identical case data and an identical task.
        const alertId = await this.alertRepository.getAlertByCaseId(caseId);
        const investigationGroup = await this.investigationGroupService.createInvestigationGroup(alertId, tenantId);

        finalCase = await this.caseRepository.updateCase(caseId, {
          case_type: CaseType.FRAUD,
          group_id: investigationGroup.id,
        });

        const amlCase = await this.caseRepository.createCase({
          tenantId: finalCase.tenant_id,
          caseCreatorUserId: finalCase.case_creator_user_id,
          caseOwnerUserId: finalCase.case_owner_user_id,
          status: finalCase.status,
          priority: finalCase.priority,
          caseType: CaseType.AML,
          caseCreationType: finalCase.case_creation_type,
          groupId: investigationGroup.id,
        });

        // isFraudNAML: true routes the BPMN process straight to "Investigate Case" -
        // correct here since, like createCaseWithInvestigationTask's cases, the AML
        // case is a resolved single-type case created directly ready-for-assignment.
        await this.flowableService.handleCaseCreated({
          caseId: amlCase.case_id,
          tenantId: amlCase.tenant_id,
          caseStatus: amlCase.status,
          creationType: amlCase.case_creation_type,
          creatorRole: 'SUPERVISOR',
          isReopened: false,
          isFraudNAML: true,
        });

        // The AML case is created directly at READY_FOR_ASSIGNMENT, skipping the
        // draft/approval stages the FRAUD case actually went through. Backfill the
        // same "Complete New Case" and "Approve Case Creation" task history (both
        // already completed) so the AML case's timeline mirrors the FRAUD case's.
        // BPMN never creates these tasks on the isFraudNAML=true route (it jumps
        // straight to Investigate Case), so there's no matching Flowable task to
        // complete for them - these are Postgres-only historical stubs.
        const tasksToBackfill = await this.taskRepository.findTasks(
          { case_id: finalCase.case_id, name: { in: [TASK_NAMES.COMPLETE_NEW_CASE, TASK_NAMES.APPROVE_CASE_CREATION] } },
          tenantId,
          false,
        );

        await this.taskService.createTask(
          {
            caseId: amlCase.case_id,
            status: TaskStatus.STATUS_30_COMPLETED,
            assignedUserId: tasksToBackfill.find((t) => t.name === TASK_NAMES.COMPLETE_NEW_CASE)?.assigned_user_id ?? undefined,
            name: TASK_NAMES.COMPLETE_NEW_CASE,
            description: 'Complete the draft case by providing all required information',
            candidateGroup:
              tasksToBackfill.find((t) => t.name === TASK_NAMES.COMPLETE_NEW_CASE)?.candidateGroup ?? CANDIDATE_GROUPS.INVESTIGATIONS,
          },
          supervisorId,
          tenantId,
        );

        await this.taskService.createTask(
          {
            caseId: amlCase.case_id,
            status: TaskStatus.STATUS_30_COMPLETED,
            assignedUserId: tasksToBackfill.find((t) => t.name === TASK_NAMES.APPROVE_CASE_CREATION)?.assigned_user_id ?? undefined,
            name: TASK_NAMES.APPROVE_CASE_CREATION,
            description: `Review and approve case creation for case ${amlCase.case_id}`,
            candidateGroup:
              tasksToBackfill.find((t) => t.name === TASK_NAMES.APPROVE_CASE_CREATION)?.candidateGroup ?? CANDIDATE_GROUPS.SUPERVISORS,
          },
          supervisorId,
          tenantId,
        );

        await this.flowableService.handleCaseStatusChanged({
          caseId: amlCase.case_id,
          newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        });

        await Promise.all(
          [finalCase, amlCase].map(async (relatedCase) => {
            await this.taskService.createTask(
              {
                caseId: relatedCase.case_id,
                status: TaskStatus.STATUS_01_UNASSIGNED,
                name: TASK_NAMES.INVESTIGATE_CASE,
                description: `Investigate case: ${relatedCase.case_id}`,
                candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
              },
              supervisorId,
              tenantId,
            );

            await this.loggingOrchestrationService.logActionsWithHistory(
              {
                userId: supervisorId,
                operation: 'approveCaseCreation',
                entityName: CaseCreationApprovalService.name,
                actionPerformed: `Approved case creation for case ${relatedCase.case_id}`,
                outcome: Outcome.SUCCESS,
                tenantId,
              },
              relatedCase.case_id,
              tenantId,
            );
          }),
        );

        await this.alertRepository.updateAlert(alertId, { caseId: undefined });
      } else {
        await this.taskService.createTask(
          {
            caseId,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: TASK_NAMES.INVESTIGATE_CASE,
            description: `Investigate case: ${caseId}`,
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          },
          supervisorId,
          tenantId,
        );

        await this.loggingOrchestrationService.logActionsWithHistory(
          {
            userId: supervisorId,
            operation: 'approveCaseCreation',
            entityName: CaseCreationApprovalService.name,
            actionPerformed: `Approved case creation for case ${caseId}`,
            outcome: Outcome.SUCCESS,
            tenantId,
          },
          caseId,
          tenantId,
        );
      }

      this.loggerService.log(
        `Case creation approved for case ${caseId}, investigation task(s) created as needed`,
        CaseCreationApprovalService.name,
      );

      return {
        success: true,
        case: finalCase,
        message: 'Case creation approved. Investigation task(s) created as needed.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to approve case creation: ${errorMessage}`, errorStack, CaseCreationApprovalService.name);
      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'approveCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Failed to approve case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
        tenantId,
      });

      throw error;
    }
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
    try {
      this.loggerService.log(`Supervisor ${supervisorId} rejecting case creation for case ${caseId}`, CaseCreationApprovalService.name);
      const { case: caseData, approvalTask } = await this.validateCaseCreationApprovalPreconditions(caseId, tenantId);

      const result = await this.caseRepository.transaction(async (tx) => {
        const updatedCase = await this.caseRepository.updateCase(caseId, {
          status: CaseStatus.STATUS_00_DRAFT,
        });

        await this.taskService.updateTask(
          approvalTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED, assignedUserId: supervisorId },
          supervisorId,
          tenantId,
        );

        const completeNewCaseTask = await this.taskService.createTask(
          {
            caseId,
            status: TaskStatus.STATUS_10_ASSIGNED,
            assignedUserId: caseData.case_creator_user_id,
            name: 'Complete New Case',
            description: 'Revise and complete the case as per supervisor feedback',
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          },
          supervisorId,
          tenantId,
          tx,
        );

        return { case: updatedCase, completedTask: approvalTask, newTask: completeNewCaseTask };
      });

      this.loggerService.log(
        `[REJECT_CASE_CREATION] Complete New Case task ${result.newTask.task_id} created for case ${caseId}`,
        CaseCreationApprovalService.name,
      );

      await this.commentRepository.createComment(supervisorId, {
        caseId,
        taskId: result.newTask.task_id,
        note: `Case creation rejected. Reason: ${reason}`,
        tenantId,
      });

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: CaseStatus.STATUS_00_DRAFT,
      });

      await this.flowableService.handleTaskCompleted({
        caseId,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        taskName: 'Approve Case Creation',
        completionVariables: {
          creationApproval: 'reject',
          creationComments: 'Case creation rejected by supervisor.',
        },
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: supervisorId,
          operation: 'rejectCaseCreation',
          entityName: CaseCreationApprovalService.name,
          actionPerformed: `Rejected case creation for case ${caseId}, created Complete New Case task ${result.newTask.task_id}. Reason: ${reason}`,
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        caseId,
        tenantId,
      );
      return { success: true, case: result.case, completedTask: result.completedTask, newTask: result.newTask };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(
        `Failed to reject case creation for case ${caseId}: ${errorMessage}`,
        errorStack,
        CaseCreationApprovalService.name,
      );
      await this.loggingOrchestrationService.logActions({
        userId: supervisorId,
        operation: 'rejectCaseCreation',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Failed to reject case ${caseId}: ${errorMessage}`,
        outcome: Outcome.FAILURE,
        tenantId,
      });
      throw error;
    }
  }

  async completeCase(
    caseId: number,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; case: Case; completedTask: Task; newTask: Task }> {
    const existingCase = await this.caseQueryService.retrieveCase(caseId, tenantId);
    if (!existingCase) throw new BadRequestException(`Case not found for caseId ${caseId}`);
    if (existingCase.status !== CaseStatus.STATUS_00_DRAFT) throw new BadRequestException('Only cases in DRAFT status can be completed');

    const missingFields = this.validateCaseCompletionFields(existingCase);
    if (missingFields.length > 0) {
      const msg = `Missing or invalid fields: ${missingFields.join(', ')}`;
      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'completeCase',
        entityName: CaseCreationApprovalService.name,
        actionPerformed: `Failed case completion due to missing fields [${missingFields.join(', ')}]`,
        outcome: Outcome.FAILURE,
        tenantId,
      });
      throw new BadRequestException(msg);
    }

    try {
      const result = await this.caseRepository.executeTransaction(async (tx) => {
        const updatedCase = await this.caseQueryService.updateCase(caseId, { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }, userId);
        const allTasks = await this.taskService.getTasksByCaseId(existingCase.case_id, tenantId);
        const completeNewCaseTask = allTasks.find((t) => t.name === 'Complete New Case');
        if (!completeNewCaseTask) throw new BadRequestException('No Complete New Case task found');
        if (completeNewCaseTask.status === TaskStatus.STATUS_30_COMPLETED) {
          throw new BadRequestException(`Complete New Case task ${completeNewCaseTask.task_id} is already completed`);
        }
        const updatedTask = await this.taskService.updateTask(
          completeNewCaseTask.task_id,
          { status: TaskStatus.STATUS_30_COMPLETED },
          userId,
          tenantId,
        );
        // Updated Implementation Might Need to Move
        await this.flowableService.handleTaskCompleted({
          caseId: updatedTask.case_id,
          taskName: updatedTask.name!,
          newStatus: updatedTask.status,
          completionVariables: {
            autoCloseEligible: false,
            CaseType: updatedCase.case_type,
            casePriority: existingCase.priority,
            draftApprovalRequired: false,
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
        tenantId,
      );

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'completeCase',
          entityName: CaseCreationApprovalService.name,
          actionPerformed: `Completed case ${caseId} and created Investigate Case task ${investigateTask.task_id}`,
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        caseId,
        tenantId,
      );

      return { success: true, case: result.case, completedTask: result.completedTask, newTask: investigateTask };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      this.loggerService.error('completeCase failed', { error: errorMessage, stack: errorStack, caseId, userId, tenantId });
      throw new InternalServerErrorException(`Failed to complete case: ${errorMessage}`);
    }
  }

  async updateCaseStatus(
    caseId: number,
    status: CaseStatus,
    userId: string,
    tenantId: string,
    priority?: Priority,
    caseType?: CaseType,
    groupId?: number,
  ): Promise<Case> {
    this.loggerService.log(`Start - Update Case Status for case ${caseId} to status ${status}`, CaseCreationApprovalService.name);
    try {
      const updateData: Record<string, unknown> = {
        status,
        priority,
        case_type: caseType,
      };
      if (groupId !== undefined) {
        updateData.group_id = groupId;
      }
      if (status === CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT) {
        await this.taskRepository.transaction(async (tx) => {
          // Fetch the case to get the tenant_id
          const caseRecord = await this.taskRepository.findCaseBasic(caseId, tenantId, tx);
          if (!caseRecord) {
            throw new NotFoundException(`Case ${caseId} not found`);
          }

          if (caseType !== CaseType.FRAUD_AND_AML) {
            await this.taskRepository.createTask(
              {
                case: {
                  connect: { case_id: caseId },
                },
                tenant_id: caseRecord.tenant_id,
                name: TASK_NAMES.INVESTIGATE_CASE,
                description: `Investigate case: ${caseId}`,
                status: TaskStatus.STATUS_01_UNASSIGNED,
                candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
              },
              tx,
            );
          }
        });
      }

      if (CLOSED_CASE_STATUSES.includes(status)) {
        updateData.case_owner_user_id = userId;
        updateData.final_outcome = status;
      }
      const updatedCase = await this.caseRepository.updateCase(caseId, updateData);

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: status,
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'updateCaseStatus',
          entityName: 'CaseCreationApprovalService',
          actionPerformed: `Updated case ${caseId} status to ${status}`,
          outcome: Outcome.SUCCESS,
          tenantId: updatedCase.tenant_id,
        },
        caseId,
        updatedCase.tenant_id,
      );

      this.loggerService.log(`End - Update Case Status for case ${caseId} to status ${status}`, CaseCreationApprovalService.name);
      return updatedCase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to update case status for ${caseId}: ${errorMessage}`, errorStack, CaseCreationApprovalService.name);
      throw error;
    }
  }

  private async validateCaseCreationApprovalPreconditions(caseId: number, tenantId: string): Promise<{ case: Case; approvalTask: Task }> {
    const caseData = await this.caseRepository.findCaseWithApprovalTask(caseId, tenantId);

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
    if (!caseData.case_type) missingFields.push('case_type');
    if (!caseData.case_creator_user_id) missingFields.push('case_creator_user_id');

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Case has missing required fields',
        missingFields,
      });
    }

    const approvalTask = caseData.tasks.find((t) => t.name === 'Approve Case Creation' && t.status === TaskStatus.STATUS_01_UNASSIGNED);
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

    return { case: caseData, approvalTask };
  }
}
