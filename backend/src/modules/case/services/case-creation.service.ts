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
        parentId: createCaseDTO.parentId ?? null,
        caseType: createCaseDTO.caseType,
        caseCreationType: createCaseDTO.caseCreationType,
      });

      await this.executeFlowableCaseCreationEvent(createdCase, createCaseDTO.caseCreationType, false, userRole);

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'createCase',
          entityName: 'CaseCreationService',
          actionPerformed: `Case ${createdCase.case_id} created successfully`,
          outcome: Outcome.SUCCESS,
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
    parentCaseId: number,
    priority: Priority,
    caseCreationType: CaseCreationType = CaseCreationType.AUTOMATIC_SYSTEM,
    userRole: string,
  ): Promise<unknown> {
    try {
      const newCase = await this.caseRepository.createCase({
        caseCreatorUserId: userId,
        caseOwnerUserId: userId,
        tenantId,
        priority,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        parentId: parentCaseId,
        caseType: alertType,
        caseCreationType,
      });

      await this.executeFlowableCaseCreationEvent(newCase, caseCreationType, true, userRole);
      // await this.flowableService.handleCaseCreated({
      //   caseId: newCase.case_id,
      //   tenantId: newCase.tenant_id,
      //   caseStatus: newCase.status,
      //   creationType: caseCreationType,
      //   creatorRole: role,
      //   isReopened: false,
      // });

      await this.taskService.createTask(
        {
          caseId: newCase.case_id,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate Case',
          description: `Investigation task for manually created case ${newCase.case_id}`,
          candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
        },
        userId,
        tenantId,
      );

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'ADDITIONAL_CASE_CREATED',
        entityName: 'CaseCreationService',
        actionPerformed: `Created ${alertType} child case ${newCase.case_id} linked to parent ${parentCaseId}. BPMN will create investigation task.`,
        outcome: Outcome.SUCCESS,
      });

      this.loggerService.log(
        `Child case ${newCase.case_id} (${alertType}) created. BPMN workflow will create investigation task.`,
        CaseCreationService.name,
      );

      return {
        caseId: newCase.case_id,
        message: 'Child case created, BPMN will create investigation task',
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
    const caseDetail: CreateCaseDto = {
      tenantId,
      caseCreatorUserId: userId,
      caseOwnerUserId: caseOwnerId,
      status: caseStatus,
      caseType,
      priority,
      caseCreationType: CaseCreationType.MANUAL,
    };

    const existingAlert = await this.caseRepository.findAlert(dto.alertId, tenantId);
    if (!existingAlert) {
      throw new BadRequestException('Alert Not Found');
    }
    if (existingAlert.case_id || (existingAlert.alert_data as unknown as { status: string })?.status !== 'NALT') {
      throw new BadRequestException('Case Already Exists');
    }

    try {
      const createdCase = await this.caseRepository.createCase(caseDetail);
      await this.executeFlowableCaseCreationEvent(createdCase, CaseCreationType.MANUAL, false, userRole);
      // await this.flowableService.handleCaseCreated({
      //   caseId: createdCase.case_id,
      //   tenantId,
      //   caseStatus,
      //   creationType: CaseCreationType.MANUAL,
      //   creatorRole: role,
      //   isReopened: false,
      // });

      const result = await this.caseRepository.transaction(async (tx) => {
        const updatedAlert = await this.alertRepository.updateAlert(
          dto.alertId,
          {
            caseId: createdCase.case_id,
            priority,
            priority_score: priorityScore,
            alertType: dto.alertType,
          },
          tx,
        );
        // await this.flowableService.handleTaskCompleted({
        //   caseId: createdCase.case_id,
        //   newStatus: TaskStatus.STATUS_30_COMPLETED,
        //   taskName: 'Complete New Case',
        //   completionVariables: {
        //     autoCloseEligible: false,
        //     caseType: updatedAlert.alert_type,
        //     casePriority: priority,
        //   },
        // });

        if (needsApproval) {
          await this.taskService.createTask(
            {
              caseId: createdCase.case_id,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: 'Approve Case Creation',
              description: `Manual Case Creation Approval For Case ${createdCase.case_id}`,
              candidateGroup: CANDIDATE_GROUPS.SUPERVISORS,
            },
            userId,
            tenantId,
            tx,
          );
        } else if (isFraudNAML) {
          await this.createCaseWithInvestigationTask(
            CaseType.AML,
            userId,
            tenantId,
            createdCase.case_id,
            priority,
            CaseCreationType.AUTOMATIC_SYSTEM,
            userRole,
          );
          await this.createCaseWithInvestigationTask(
            CaseType.FRAUD,
            userId,
            tenantId,
            createdCase.case_id,
            priority,
            CaseCreationType.AUTOMATIC_SYSTEM,
            userRole,
          );
        } else {
          await this.taskService.createTask(
            {
              caseId: createdCase.case_id,
              status: TaskStatus.STATUS_01_UNASSIGNED,
              name: 'Investigate Case',
              description: `Investigation task for manually created case ${createdCase.case_id}`,
              candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            },
            userId,
            tenantId,
            tx,
          );
        }

        return { alert: updatedAlert };
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          actionPerformed: `Manual case ${createdCase.case_id} created for alert ${dto.alertId}'}`,
          entityName: CaseCreationService.name,
          operation: 'createManualCase',
          outcome: Outcome.SUCCESS,
        },
        createdCase.case_id,
        tenantId,
      );

      this.loggerService.log(
        `End - Manual Case Creation. Case ${createdCase.case_id} created for alert ${dto.alertId} }`,
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
    // for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    //   try {
    //     await flowableCaseCreation();
    //     return;
    //   } catch (error) {
    //     const errorMessage = error instanceof Error ? error.message : String(error);
    //     const errorStack = error instanceof Error ? error.stack : undefined;
    //     this.loggerService.error(
    //       `Attempt ${attempt} - Failed to trigger Flowable case creation event for case ${createdCase.case_id}: ${errorMessage}`,
    //       errorStack,
    //       CaseCreationService.name,
    //     );
    //     if (attempt === maxAttempts) {
    //       throw new InternalServerErrorException(
    //         `Failed to trigger Flowable case creation event after ${maxAttempts} attempts for case ${createdCase.case_id}`,
    //       );
    //     }
    //   }
    // }
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
