import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseCreationType, CaseStatus, CaseType, Priority, TaskStatus } from '@prisma/client-cms';
import { CANDIDATE_GROUPS } from 'src/constants/case.constants';
import { CaseRepository } from 'src/modules/repository/case.repository';
import { TaskService } from 'src/modules/task/task.service';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';

@Injectable()
export class CaseCreationService {
  constructor(
    private readonly logger: LoggerService,
    private readonly caseRepository: CaseRepository,
    private readonly taskService: TaskService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
  ) {}

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
        priority: priority,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        parentId: parentCaseId,
        caseType: alertType as CaseType,
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
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
      );

      await this.loggingOrchestrationService.logActions({
        userId: userId.toString(),
        operation: 'ADDITIONAL_CASE_CREATED',
        entityName: 'Case',
        actionPerformed: `Created ${alertType} child case ${newCase.case_id} linked to parent ${parentCaseId}. BPMN will create investigation task.`,
        outcome: Outcome.SUCCESS,
      });

      this.logger.log(
        `Child case ${newCase.case_id} (${alertType}) created. BPMN workflow will create investigation task.`,
        CaseCreationService.name,
      );

      return {
        caseId: newCase.case_id,
        message: 'Child case created, BPMN will create investigation task',
      };
    } catch (error) {
      this.logger.error(`Failed to create ${alertType} case. Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create ${alertType} case`);
    }
  }
}
