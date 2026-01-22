import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseRepository } from '../repository/case.repository';
import { FlowableService } from '../flowable/flowable.service';
import { CaseStatus, Priority, CaseType, Case } from '@prisma/client-cms';
import { CANDIDATE_GROUPS } from 'src/constants/case.constants';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { TaskSyncService } from '../task-sync/task-sync.service';

@Injectable()
export class CaseSyncService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly taskSyncService: TaskSyncService,
    private readonly flowableService: FlowableService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

  async syncCaseStatusWithFlowable(
    caseId: number,
    status: CaseStatus,
    userId: string,
    priority?: Priority,
    caseType?: CaseType,
  ): Promise<Case> {
    this.loggerService.log(`Start - syncCaseStatusWithFlowable`, CaseSyncService.name);
    try {
      let updatedCase: Case;
      const updateData: Record<string, unknown> = {
        status,
        priority,
        case_type: caseType,
      };

      this.flowableService.handleCaseStatusChanged({
        caseId,
        newStatus: status,
        reason: 'Case status updated',
      });

      await this.caseRepository.transaction(async (tx) => {
        updatedCase = await this.caseRepository.updateCase(caseId, updateData);
        await this.taskSyncService.syncTaskCreationWithFlowable(userId, caseId, CANDIDATE_GROUPS.INVESTIGATIONS, tx);
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId,
          operation: 'updateCaseStatus',
          entityName: 'CaseSyncService',
          actionPerformed: `Updated case ${caseId} status to ${status}`,
          outcome: Outcome.SUCCESS,
        },
        caseId,
      );

      this.loggerService.log(`End - Update Case Status for case ${caseId} to status ${status}`, CaseSyncService.name);
      return updatedCase!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to update case status for ${caseId}: ${errorMessage}`, errorStack, CaseSyncService.name);
      throw error;
    }
  }
}
