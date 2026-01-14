import { Injectable } from '@nestjs/common';
import { CreateCaseDto } from '../dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { FlowableService } from 'src/modules/flowable/flowable.service';
import { Outcome } from 'src/utils/types/outcome';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';

@Injectable()
export class CaseCreationService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly caseRepository: CaseRepository,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async createCase(createCaseDTO: CreateCaseDto, userId: string) {
    try {
      this.loggerService.log(`Start - Create Case`, CaseCreationService.name);
      const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();
      const isTriageDisabled = triageType === 'DISABLED' ? true : false;

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
        isTriageDisabled,
        creatorRole: 'SYSTEM',
      });

      this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'createCase',
          entityName: 'CaseCreationApprovalService',
          actionPerformed: `Case ${createdCase.case_id} created successfully`,
          outcome: Outcome.SUCCESS,
        },
        createdCase.case_id,
      );

      this.loggerService.log(`End - Create Case - ${createdCase.case_id}`, CaseCreationService.name);
      return createdCase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`[CaseWorkflow] Error creating case: ${errorMessage}`, errorStack, CaseCreationService.name);
      throw error;
    }
  }
}
