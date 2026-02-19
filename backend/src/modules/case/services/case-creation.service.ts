import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseCreationType, CaseStatus, CaseType, Priority, TaskStatus } from '@prisma/client-cms';
import { CANDIDATE_GROUPS } from 'src/constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { CreateCaseDto } from '../dto';
import { ConfigService } from '@nestjs/config';
import { FlowableService } from 'src/modules/flowable/flowable.service';

@Injectable()
export class CaseCreationService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly taskService: TaskService,
    private readonly configService: ConfigService,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string, tenantId: string) {
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

      this.flowableService.handleCaseCreated({
        caseId: createdCase.case_id,
        tenantId: createdCase.tenant_id,
        caseStatus: createdCase.status,
        creationType: createCaseDTO.caseCreationType,
        creatorRole: 'SYSTEM',
      });

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

      this.flowableService.handleCaseCreated({
        caseId: newCase.case_id,
        tenantId: newCase.tenant_id,
        caseStatus: newCase.status,
        creationType: CaseCreationType.AUTOMATIC_SYSTEM,
        creatorRole: 'SYSTEM',
      });

      await this.flowableService.handleTaskCompleted({
        caseId: newCase.case_id,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        taskName: 'Complete New Case',
        completionVariables: {
          autoCloseEligible: false,
          caseType: newCase.case_type,
          casePriority: newCase.priority,
        },
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
        userId: userId.toString(),
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
}
