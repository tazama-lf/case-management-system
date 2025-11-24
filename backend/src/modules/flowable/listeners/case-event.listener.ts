import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BpmnSyncService } from '../services/bpmn-sync.service';
import { FlowableUtilitiesService } from '../utils/flowable-utilities.service';
import { CaseCreatedEvent, CaseStatusChangedEvent, CaseAbandonedEvent, CaseSuspendedEvent } from '../../events/domain-events';
import { FlowableProcessService } from '../services/flowable-process.service';

/**
 * Listener for case-related domain events
 * Handles case lifecycle events and syncs them with Flowable process instances
 */
@Injectable()
export class CaseEventListener {
  constructor(
    private readonly flowableProcessService: FlowableProcessService,
    private readonly logger: LoggerService,
    private readonly flowableUtilitiesService: FlowableUtilitiesService,
    private readonly bpmnSyncService: BpmnSyncService,
  ) {}

  /**
   * Handle case.created event
   * Starts a new Flowable process instance and syncs BPMN tasks
   */
  @OnEvent('case.created')
  async handleCaseCreated(event: CaseCreatedEvent) {
    try {
      this.logger.log(
        `[CaseEventListener] Starting process for case ${event.caseId} with status ${event.caseStatus}`,
        CaseEventListener.name,
      );

      const creatorRole = event.creatorRole || (event.creationType === 'MANUAL' ? 'ANALYST' : 'SYSTEM');

      this.logger.log(
        `[CaseEventListener] Case ${event.caseId} - creationType: ${event.creationType}, creatorRole: ${creatorRole}, autocloseEligible: ${event.autocloseEligible}`,
        CaseEventListener.name,
      );

      const processInstance = await this.flowableProcessService.startProcessInstance(
        'caseManagementProcess',
        {
          caseId: event.caseId,
          tenantId: event.tenantId,
          creationType: event.creationType,
          caseStatus: event.caseStatus,
          autocloseEligible: String(event.autocloseEligible),
          isTriageAlert: String(event.isTriageAlert),
          creatorRole: creatorRole,
        },
        event.caseId,
        event.tenantId,
      );

      this.logger.log(
        `[CaseEventListener] Successfully started process ${processInstance.id} for case ${event.caseId} with creatorRole: ${creatorRole}`,
        CaseEventListener.name,
      );

      // Sync BPMN tasks to PostgreSQL only if requested
      if (event.shouldSyncBpmnTasks) {
        try {
          await this.bpmnSyncService.syncAllTasksForCase(event.caseId, processInstance.id);
          this.logger.log(`[CaseEventListener] BPMN task sync completed for case ${event.caseId}`, CaseEventListener.name);
        } catch (syncError) {
          this.logger.error(
            `[CaseEventListener] BPMN task sync failed for case ${event.caseId}: ${syncError.message}`,
            syncError.stack,
            CaseEventListener.name,
          );
        }
      } else {
        this.logger.log(
          `[CaseEventListener] Skipping BPMN task sync for case ${event.caseId} (shouldSyncBpmnTasks=false)`,
          CaseEventListener.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `[CaseEventListener] Failed to start process for case ${event.caseId}: ${error.message}`,
        error.stack,
        CaseEventListener.name,
      );
    }
  }

  /**
   * Handle case.status.changed event
   * Updates the Flowable process instance variables to reflect the new case status
   */
  @OnEvent('case.status.changed')
  async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
    const eventKey = `case-status-${event.caseId}-${event.newStatus}`;

    if (this.flowableUtilitiesService.isDuplicate(eventKey)) {
      this.logger.debug(`Skipping duplicate case.status.changed event for case ${event.caseId}`, CaseEventListener.name);
      return;
    }

    try {
      this.logger.log(
        `[CaseEventListener] Processing status change for case ${event.caseId}: ${event.oldStatus} → ${event.newStatus}`,
        CaseEventListener.name,
      );

      const processInstance = await this.flowableProcessService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn(`[CaseEventListener] No Flowable process found for case ${event.caseId}`, CaseEventListener.name);
        return;
      }

      try {
        await this.flowableProcessService.updateProcessVariable(processInstance.id as string, 'case_status', event.newStatus);

        await this.flowableProcessService.updateProcessVariable(
          processInstance.id as string,
          'status_change_reason',
          event.reason || 'Status updated',
        );

        await this.flowableProcessService.updateProcessVariable(
          processInstance.id as string,
          'status_changed_at',
          new Date().toISOString(),
        );

        await this.flowableProcessService.updateProcessVariable(processInstance.id as string, 'previous_status', event.oldStatus);

        this.logger.log(
          `[CaseEventListener] ✓ Updated Flowable process ${processInstance.id} status for case ${event.caseId}: ${event.oldStatus} → ${event.newStatus}`,
          CaseEventListener.name,
        );
      } catch (updateError) {
        this.logger.warn(
          `[CaseEventListener] Failed to update some process variables, but continuing: ${updateError.message}`,
          CaseEventListener.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `[CaseEventListener] Failed to update Flowable process status: ${error.message}`,
        error.stack,
        CaseEventListener.name,
      );
    }
  }

  /**
   * Handle case.abandoned event
   * Terminates the Flowable process instance when a case is abandoned
   */
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

  /**
   * Handle case.suspended event
   * Terminates the Flowable process instance when a case is suspended
   */
  @OnEvent('case.suspended')
  async handleSuspendCase(event: CaseSuspendedEvent) {}
}
