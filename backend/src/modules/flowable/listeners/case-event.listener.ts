import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BpmnSyncService } from '../services/bpmn-sync.service';
import { FlowableUtilitiesService } from '../utils/flowable-utilities.service';
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
  async handleCaseCreated(event: CaseCreatedEvent) {
    try {
      this.logger.log(`Start - Process CaseID: ${event.caseId}`, CaseEventListener.name);

      const processInstance = await this.flowableProcessService.startProcessInstance(
        'caseManagementProcess',
        {
          caseId: event.caseId,
          tenantId: event.tenantId,
          creationType: event.creationType,
          autocloseEligible: String(event.autocloseEligible),
          caseStatus: event.caseStatus,
          isTriageAlert: String(event.isTriageAlert),
        },
        event.caseId,
        event.tenantId,
      );

      this.logger.log(
        `[CaseEventListener] Successfully started process ${processInstance.id} for case ${event.caseId}`,
        CaseEventListener.name,
      );
    } catch (error) {
      this.logger.error(
        `[CaseEventListener] Failed to start process for case ${event.caseId}: ${error.message}`,
        error.stack,
        CaseEventListener.name,
      );
    }
  }

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
      this.logger.error(`Failed To Update Case Status: ${error.message}`, error.stack, CaseEventListener.name);
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
      this.logger.error(
        `[CaseEventListener] Failed to terminate Flowable process for case ${event.caseId}: ${error.message}`,
        error.stack,
        CaseEventListener.name,
      );
    }
  }

  @OnEvent('case.suspended')
  async handleSuspendCase(event: CaseSuspendedEvent) {}
}
