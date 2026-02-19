import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BpmnSyncService } from '../services/bpmn-sync.service';
import { FlowableUtilitiesService } from '../services/flowable-utilities.service';
import { CaseCreatedEvent, CaseStatusChangedEvent, CaseAbandonedEvent, CaseSuspendedEvent } from '../../events/domain-events';
import { FlowableProcessService } from '../services/flowable-process.service';

@Injectable()
export class CaseEventListener {
  constructor(
    private readonly flowableProcessService: FlowableProcessService,
    private readonly logger: LoggerService,
    // private readonly flowableUtilitiesService: FlowableUtilitiesService,
    // private readonly bpmnSyncService: BpmnSyncService,
  ) {}

  @OnEvent('case.created')
  async handleCaseCreated(event: CaseCreatedEvent) {}

  @OnEvent('case.status.changed')
  async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
    this.logger.log(`Start - Update Case Status for case ${event.caseId} to status ${event.newStatus}`, CaseEventListener.name);
    try {
      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn(`No Flowable process found for case ${event.caseId}`, CaseEventListener.name);
        throw new NotFoundException('Process instance not found');
      }

      await this.flowableProcessService.updateProcessVariable(processInstance.id as string, 'caseStatus', event.newStatus);
      this.logger.log(`Updated Case Status To ${event.newStatus} For Process ${processInstance.id}`, CaseEventListener.name);
    } catch (error) {
      throw error;
    }
  }

  @OnEvent('case.abandoned')
  async handleCaseAbandoned(event: CaseAbandonedEvent) {
    try {
      this.logger.log(`[CaseEventListener] Processing case abandonment for case ${event.caseId}`, CaseEventListener.name);

      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

      if (processInstance) {
        await this.flowableProcessService.terminateProcessInstance(processInstance.id as string, `Case abandoned: ${event.reason}`);
        this.logger.log(
          `[CaseEventListener] ✓ Terminated Flowable process ${processInstance.id} for abandoned case ${event.caseId}`,
          CaseEventListener.name,
        );
      } else {
        this.logger.warn(`[CaseEventListener] No Flowable process found for abandoned case ${event.caseId}`, CaseEventListener.name);
      }
    } catch (error) {
      throw error;
    }
  }

  @OnEvent('case.suspended')
  async handleSuspendCase(event: CaseSuspendedEvent) {
    // Empty handler for future use
  }
}
