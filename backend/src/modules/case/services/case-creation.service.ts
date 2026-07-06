import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseCreationType, CaseStatus, CaseType, Priority, TaskStatus, Case, Alert } from '@prisma/client-cms';
import { CANDIDATE_GROUPS } from 'src/constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { CreateCaseDto, ManualCreateCaseDto } from '../dto';
import { FlowableService } from 'src/modules/flowable/flowable.service';
import { CasePriorityUtil } from 'src/modules/shared/utils/case-priority.util';
import { AlertRepository } from 'src/modules/repository/alert.repository';
import { setTimeout } from 'node:timers/promises';
import { InvestigationGroupService } from 'src/modules/investigation-group/investigation-group.service';

@Injectable()
export class CaseCreationService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly casePriorityUtil: CasePriorityUtil,
    private readonly caseRepository: CaseRepository,
    private readonly taskService: TaskService,
    private readonly alertRepository: AlertRepository,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly investigationGroupService: InvestigationGroupService,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string, tenantId: string, userRole: string): Promise<Case> {
    try {
      this.loggerService.log('Start - Create Case', CaseCreationService.name);

      const createdCase = await this.caseRepository.createCase({
        tenantId: createCaseDTO.tenantId,
        caseCreatorUserId: createCaseDTO.caseCreatorUserId,
        caseOwnerUserId: createCaseDTO.caseOwnerUserId,
        status: createCaseDTO.status,
        priority: createCaseDTO.priority,
        caseType: createCaseDTO.caseType,
        caseCreationType: createCaseDTO.caseCreationType,
        ...(createCaseDTO.groupId === undefined ? {} : { groupId: createCaseDTO.groupId }),
      });

      await this.executeFlowableCaseCreationEvent(createdCase, createCaseDTO.caseCreationType, false, userRole);

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'createCase',
          entityName: 'CaseCreationService',
          actionPerformed: `Case ${createdCase.case_id} created successfully`,
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        createdCase.case_id,
        tenantId,
      );

      this.loggerService.log('End - Create Case', CaseCreationService.name);
      return createdCase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`[CaseWorkflow] Error creating case: ${errorMessage}`, errorStack, CaseCreationService.name);
      throw error;
    }
  }

  async createCaseWithInvestigationTask(
    alertType: CaseType,
    userId: string,
    tenantId: string,
    priority: Priority,
    caseCreationType: CaseCreationType = CaseCreationType.AUTOMATIC_SYSTEM,
    userRole: string,
    groupId?: number,
  ): Promise<{ caseId: number; message: string; taskId?: number }> {
    try {
      const createCaseDTO: CreateCaseDto = {
        tenantId,
        caseCreatorUserId: userId,
        caseOwnerUserId: undefined, // Owner assigned when investigation task is assigned
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        priority,
        caseType: alertType,
        caseCreationType,
        ...(groupId === undefined ? {} : { groupId }),
      };
      const newCase = await this.createCase(createCaseDTO, userId, tenantId, userRole);

      await this.executeFlowableCaseCreationEvent(newCase, caseCreationType, true, userRole);

      const completeTask = await this.taskService.createTask(
        {
          caseId: newCase.case_id,
          status: TaskStatus.STATUS_30_COMPLETED,
          assignedUserId: userId,
          name: 'Complete New Case',
          description: `Investigation task for manually created case ${newCase.case_id}`,
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        userId,
        tenantId,
      );

      await this.taskService.createTask(
        {
          caseId: newCase.case_id,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate Case',
          description: `Created for triaging alert for case:${newCase.case_id}`,
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        userId,
        tenantId,
      );

      this.loggerService.log(
        `Case ${newCase.case_id} (${alertType}) created. BPMN workflow will create investigation task.`,
        CaseCreationService.name,
      );

      return {
        caseId: newCase.case_id,
        message: 'Case created, BPMN will create investigation task',
        taskId: completeTask.task_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to create ${alertType} case. Error: ${errorMessage}`, errorStack, CaseCreationService.name);
      throw new InternalServerErrorException(`Failed to create ${alertType} case`);
    }
  }

  async manualCaseCreation(
    dto: ManualCreateCaseDto,
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<{ success: boolean; case?: Case; alert?: Alert; message?: string }> {
    this.loggerService.log('Start - Manual Case Creation', CaseCreationService.name);
    const { priorityScore } = dto;
    const priority = this.casePriorityUtil.determinePriority(priorityScore);
    const caseType = dto.alertType;
    const isFraudNAML = caseType === CaseType.FRAUD_AND_AML;
    const needsApproval = userRole !== 'SUPERVISOR';
    const caseStatus = needsApproval ? CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL : CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;
    const caseOwnerId = needsApproval ? undefined : userId;

    const existingAlert = await this.caseRepository.findAlert(dto.alertId, tenantId);
    if (!existingAlert) {
      throw new BadRequestException('Alert Not Found');
    }
    if (existingAlert.case_id ?? (existingAlert.alert_data as unknown as { status: string }).status !== 'NALT') {
      throw new BadRequestException('Case Already Exists');
    }

    const investigationGroup = isFraudNAML
      ? await this.investigationGroupService.createInvestigationGroup(dto.alertId, tenantId)
      : undefined;
    const primaryCaseType = isFraudNAML && !needsApproval ? CaseType.FRAUD : caseType;
    const caseDetail: CreateCaseDto = {
      tenantId,
      caseCreatorUserId: userId,
      caseOwnerUserId: caseOwnerId,
      status: caseStatus,
      caseType: primaryCaseType,
      priority,
      caseCreationType: CaseCreationType.MANUAL,
      ...(investigationGroup === undefined ? {} : { groupId: investigationGroup.id }),
    };

    try {
      const createdCase = await this.createCase(caseDetail, userId, tenantId, userRole);
      await this.executeFlowableCaseCreationEvent(createdCase, CaseCreationType.MANUAL, false, userRole);

      const relatedCases = [createdCase];
      let amlCase: Case | undefined;
      if (isFraudNAML && !needsApproval) {
        const createCaseDTO: CreateCaseDto = {
          tenantId,
          caseCreatorUserId: userId,
          caseOwnerUserId: caseOwnerId,
          status: caseStatus,
          caseType: CaseType.AML,
          priority,
          caseCreationType: CaseCreationType.MANUAL,
          ...(investigationGroup === undefined ? {} : { groupId: investigationGroup.id }),
        };
        amlCase = await this.createCase(createCaseDTO, userId, tenantId, userRole);
        await this.executeFlowableCaseCreationEvent(amlCase, CaseCreationType.MANUAL, false, userRole);
        relatedCases.push(amlCase);
      }

      const result = await this.caseRepository.transaction(async (tx) => {
        const updatedAlert = await this.alertRepository.updateAlert(
          dto.alertId,
          {
            caseId: isFraudNAML ? undefined : createdCase.case_id,
            priority,
            priority_score: priorityScore,
            alertType: dto.alertType,
          },
          tx,
        );

        await Promise.all(
          relatedCases.map(
            async (relatedCase) =>
              await this.taskService.createTask(
                {
                  caseId: relatedCase.case_id,
                  status: TaskStatus.STATUS_01_UNASSIGNED,
                  name: needsApproval ? 'Approve Case Creation' : 'Investigate Case',
                  description: needsApproval
                    ? `Manual Case Creation Approval For Case ${relatedCase.case_id}`
                    : `Investigation task for manually created case ${relatedCase.case_id}`,
                  candidateGroup: needsApproval ? CANDIDATE_GROUPS.SUPERVISORS : CANDIDATE_GROUPS.INVESTIGATIONS,
                },
                userId,
                tenantId,
                tx,
              ),
          ),
        );

        return { alert: updatedAlert };
      });

      await this.loggingOrchestrationService.logActions({
        userId,
        actionPerformed: `Manual case ${isFraudNAML ? `FRAUD: ${createdCase.case_id} AML: ${amlCase?.case_id}` : createdCase.case_id} created for alert ${dto.alertId}`,
        entityName: CaseCreationService.name,
        operation: 'createManualCase',
        outcome: Outcome.SUCCESS,
        tenantId,
      });

      this.loggerService.log(
        `End - Manual Case Creation. Case ${createdCase.case_id} created for alert ${dto.alertId}`,
        CaseCreationService.name,
      );

      return {
        success: true,
        case: createdCase,
        alert: result.alert,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      this.loggerService.error('Manual case creation failed', {
        error: errorMessage,
        stack: errorStack,
        dto,
        userId,
        tenantId,
      });
      throw new InternalServerErrorException(`Failed to create case & link alert: ${errorMessage}`);
    }
  }

  private async executeFlowableCaseCreationEvent(
    createdCase: Case,
    caseCreationType: CaseCreationType,
    isFraudNAML: boolean,
    userRole: string,
  ): Promise<void> {
    const maxAttempts = 5;
    const flowableCaseCreation = async (): Promise<void> => {
      await this.flowableService.handleCaseCreated({
        caseId: createdCase.case_id,
        tenantId: createdCase.tenant_id,
        caseStatus: createdCase.status,
        creationType: caseCreationType,
        creatorRole: userRole,
        isReopened: false,
        isFraudNAML,
      });
    };

    await this.retry(flowableCaseCreation, maxAttempts);
  }

  private async retry(fn: () => Promise<void>, maxRetries: number, attempt = 1): Promise<void> {
    try {
      await fn();
    } catch (error) {
      if (attempt >= maxRetries) throw error;

      await setTimeout(1000 * attempt);
      await this.retry(fn, maxRetries, attempt + 1);
    }
  }
}
