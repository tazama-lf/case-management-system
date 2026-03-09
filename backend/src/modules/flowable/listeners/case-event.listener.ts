import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseStatusChangedEvent, CaseAbandonedEvent } from '../../events/domain-events';
import { FlowableProcessService } from '../services/flowable-process.service';

@Injectable()
export class CaseEventListener {
  constructor(
    private readonly flowableProcessService: FlowableProcessService,
    private readonly logger: LoggerService,
  ) {}

  async handleCaseStatusChanged(event: CaseStatusChangedEvent): Promise<void> {
    this.logger.log(`Start - Update Case Status for case ${event.caseId} to status ${event.newStatus}`, CaseEventListener.name);
    const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

    if (!processInstance) {
      this.logger.warn(`No Flowable process found for case ${event.caseId}`, CaseEventListener.name);
      throw new NotFoundException('Process instance not found');
    }

    await this.flowableProcessService.updateProcessVariable(processInstance.id, 'caseStatus', event.newStatus);
    this.logger.log(`Updated Case Status To ${event.newStatus} For Process ${processInstance.id}`, CaseEventListener.name);
  }

  async handleCaseAbandoned(event: CaseAbandonedEvent): Promise<void> {
    this.logger.log(`[CaseEventListener] Processing case abandonment for case ${event.caseId}`, CaseEventListener.name);

    const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

    if (processInstance) {
      await this.flowableProcessService.terminateProcessInstance(processInstance.id, `Case abandoned: ${event.reason}`);
      this.logger.log(
        `[CaseEventListener] ✓ Terminated Flowable process ${processInstance.id} for abandoned case ${event.caseId}`,
        CaseEventListener.name,
      );
    } else {
      this.logger.warn(`[CaseEventListener] No Flowable process found for abandoned case ${event.caseId}`, CaseEventListener.name);
    }
  }
}
