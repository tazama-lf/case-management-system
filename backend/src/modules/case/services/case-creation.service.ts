import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseCreationType, CaseStatus, CaseType, Priority, TaskStatus, Case } from '@prisma/client-cms';
import { CANDIDATE_GROUPS } from 'src/constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { CreateCaseDto } from '../dto';
import { FlowableService } from 'src/modules/flowable/flowable.service';

@Injectable()
export class CaseCreationService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly taskService: TaskService,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string, tenantId: string): Promise<Case> {
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

      await this.executeFlowableCaseCreationEvent(createdCase, createCaseDTO);

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
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      });

      await this.flowableService.handleCaseCreated({
        caseId: newCase.case_id,
        tenantId: newCase.tenant_id,
        caseStatus: newCase.status,
        creationType: CaseCreationType.AUTOMATIC_SYSTEM,
        creatorRole: 'SYSTEM',
        isReopened: false,
      });

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

  private async executeFlowableCaseCreationEvent(createdCase: Case, createCaseDTO: CreateCaseDto, maxAttempts = 3): Promise<void> {
    const flowableCaseCreation = async () => {
      this.flowableService.handleCaseCreated({
        caseId: createdCase.case_id,
        tenantId: createdCase.tenant_id,
        caseStatus: createdCase.status,
        creationType: createCaseDTO.caseCreationType,
        creatorRole: 'SYSTEM',
        isReopened: false,
      });
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await flowableCaseCreation();
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.loggerService.error(
          `Attempt ${attempt} - Failed to trigger Flowable case creation event for case ${createdCase.case_id}: ${errorMessage}`,
          errorStack,
          CaseCreationService.name,
        );
        if (attempt === maxAttempts) {
          throw new InternalServerErrorException(
            `Failed to trigger Flowable case creation event after ${maxAttempts} attempts for case ${createdCase.case_id}`,
          );
        }
      }
    }
  }
}
