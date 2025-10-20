import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from '../flowable.service';
import { TaskService } from '../../task/task.service';

import {
  CaseCreatedEvent,
  CaseStatusChangedEvent,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskAssignedEvent,
  CaseAbandonedEvent,
  TaskUnassignedEvent,
  BpmnTaskCreatedEvent,
} from '../../events/domain-events';
import { TaskStatus } from '@prisma/client';
import { AuditLogService } from '../../audit/auditLog.service';

@Injectable()
export class FlowableEventListener {
  constructor(
    private readonly flowableService: FlowableService,
    private readonly logger: LoggerService,
    private readonly taskService: TaskService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @OnEvent('case.created')
  async handleCaseCreated(event: CaseCreatedEvent) {
    try {
      this.logger.log(
        `[Flowable-CaseCreated] Received case.created event for case ${event.caseId}, creationType: ${event.creationType}, creatorRole: ${event.creatorRole}`,
        FlowableEventListener.name,
      );

      const existingProcess = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (existingProcess) {
        this.logger.warn(
          `[Flowable-CaseCreated] Process ${existingProcess.id} ALREADY EXISTS for case ${event.caseId}, skipping creation to prevent duplicates`,
          FlowableEventListener.name,
        );
        return;
      }

      this.logger.log(
        `[Flowable-CaseCreated] No existing process found, starting new process for case ${event.caseId}`,
        FlowableEventListener.name,
      );

      const processInstance = await this.flowableService.startProcessInstance(
        'caseManagementProcess',
        {
          caseId: event.caseId,
          tenantId: event.tenantId,
          creationType: event.creationType,
          creatorRole: event.creatorRole,
          autocloseEligible: event.autocloseEligible,
        },
        event.caseId,
      );

      this.logger.log(
        `[Flowable-CaseCreated] Successfully started Flowable process ${processInstance.id} for case ${event.caseId}`,
        FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
        `[Flowable-CaseCreated] Failed to start Flowable process for case ${event.caseId}: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );
    }
  }

  @OnEvent('task.created')
  async handleTaskCreated(event: TaskCreatedEvent) {
    try {
      this.logger.log(
        `Handling task.created event for task ${event.taskId} (${event.taskName}) in case ${event.caseId}`,
        FlowableEventListener.name,
      );

      await new Promise((resolve) => setTimeout(resolve, 3000)); // Increased to 3 seconds

      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn(`No Flowable process found for case ${event.caseId}`, FlowableEventListener.name);
        return;
      }

      this.logger.log(`Found process instance ${processInstance.id} for case ${event.caseId}`, FlowableEventListener.name);

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

      this.logger.log(`Found ${flowableTasks.length} Flowable tasks for process ${processInstance.id}`, FlowableEventListener.name);

      const flowableTask = flowableTasks.find((t: any) => {
        const taskVars = t.variables || [];
        const hasPostgresId = taskVars.some((v: any) => v.name === 'postgres_task_id');
        const matchesByKey = t.taskDefinitionKey === this.getTaskDefinitionKey(event.taskName);
        const matchesByName = t.name === event.taskName && !hasPostgresId;

        this.logger.log(
          `Checking task ${t.id}: name="${t.name}", key="${t.taskDefinitionKey}", hasPostgresId=${hasPostgresId}, matchesByKey=${matchesByKey}, matchesByName=${matchesByName}`,
          FlowableEventListener.name,
        );

        return matchesByKey || matchesByName;
      });

      if (flowableTask) {
        this.logger.log(
          `Found matching BPMN task ${flowableTask.id} for PostgreSQL task ${event.taskId} (${event.taskName})`,
          FlowableEventListener.name,
        );

        const syncSuccess = await this.flowableService.syncTaskWithDatabase(flowableTask.id, {
          postgres_task_id: event.taskId,
          postgres_case_id: event.caseId,
          task_status: event.status,
          assignee_user_id: event.assignedUserId,
          flowable_case_id: processInstance.id,
        });

        if (syncSuccess) {
          this.logger.log(
            `Successfully synced PostgreSQL task ${event.taskId} with Flowable BPMN task ${flowableTask.id}`,
            FlowableEventListener.name,
          );
        } else {
          this.logger.error(
            `Failed to sync PostgreSQL task ${event.taskId} with Flowable BPMN task ${flowableTask.id}`,
            '',
            FlowableEventListener.name,
          );
        }

        const identityLinks = await this.flowableService.getTaskIdentityLinks(flowableTask.id);
        const hasCandidateGroup = identityLinks.some((link: any) => link.type === 'candidate' && link.group);

        if (!hasCandidateGroup && event.candidateGroup) {
          await this.flowableService.assignTaskToCandidateGroup(flowableTask.id, event.candidateGroup);
          this.logger.log(
            `Assigned candidate group ${event.candidateGroup} to Flowable task ${flowableTask.id}`,
            FlowableEventListener.name,
          );
        }
      } else {
        this.logger.warn(
          `No matching BPMN task found for PostgreSQL task ${event.taskId} (${event.taskName}) in process ${processInstance.id}`,
          FlowableEventListener.name,
        );

        flowableTasks.forEach((t: any) => {
          this.logger.warn(`Available task: id=${t.id}, name="${t.name}", key="${t.taskDefinitionKey}"`, FlowableEventListener.name);
        });
      }
    } catch (error) {
      this.logger.error(`Failed to sync task ${event.taskId} with Flowable: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  private getTaskDefinitionKey(taskName: string): string | null {
    const mappings: Record<string, string> = {
      'Approve Case Creation': 'approveCaseCreation',
      'Investigate Case': 'investigateCase',
      'Investigate case': 'investigateCase',
      'Approve case closure': 'supervisorApproval',
    };

    return mappings[taskName] || null;
  }

  @OnEvent('task.status.changed')
  async handleTaskStatusChanged(event: TaskStatusChangedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn(`No Flowable process found for case ${event.caseId}`, FlowableEventListener.name);
        return;
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

      let flowableTask = flowableTasks.find((t: any) => {
        const taskVars = t.variables || [];
        const postgresIdVar = taskVars.find((v: any) => v.name === 'postgres_task_id');
        return postgresIdVar?.value === event.taskId;
      });

      if (!flowableTask) {
        flowableTask = flowableTasks.find((t: any) => t.name === event.taskName);
      }

      if (flowableTask) {
        await this.flowableService.updateTaskVariable(flowableTask.id, 'task_status', event.newStatus);

        if (event.newStatus === TaskStatus.STATUS_30_COMPLETED) {
          const completionVars = event.completionVariables || {};

          await this.flowableService.completeTask(flowableTask.id, completionVars);

          this.logger.log(`Completed Flowable task ${flowableTask.id} for PostgreSQL task ${event.taskId}`, FlowableEventListener.name);
        }
      } else {
        this.logger.warn(`Flowable task not found for PostgreSQL task ${event.taskId}`, FlowableEventListener.name);
      }
    } catch (error) {
      this.logger.error(`Failed to update Flowable task status: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('task.assigned')
  async handleTaskAssigned(event: TaskAssignedEvent) {
    try {
      this.logger.log(
        `[Flowable-TaskAssigned] Handling task assignment for task ${event.taskId} to user ${event.assignedUserId} in case ${event.caseId}`,
        FlowableEventListener.name,
      );

      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn(`[Flowable-TaskAssigned] No Flowable process found for case ${event.caseId}`, FlowableEventListener.name);
        return;
      }

      this.logger.log(`[Flowable-TaskAssigned] Found process ${processInstance.id} for case ${event.caseId}`, FlowableEventListener.name);

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);

      this.logger.log(
        `[Flowable-TaskAssigned] Found ${flowableTasks.length} tasks in process ${processInstance.id}`,
        FlowableEventListener.name,
      );

      const flowableTask = flowableTasks.find((ft: any) => {
        const vars = ft.variables || [];
        const postgresIdVar = vars.find((v: any) => v.name === 'postgres_task_id');
        return postgresIdVar?.value === event.taskId;
      });

      if (flowableTask) {
        this.logger.log(
          `[Flowable-TaskAssigned] Found Flowable task ${flowableTask.id} for PostgreSQL task ${event.taskId}`,
          FlowableEventListener.name,
        );

        if (event.previousAssignedUserId && flowableTask.assignee) {
          this.logger.log(
            `[Flowable-TaskAssigned] Unclaiming task ${flowableTask.id} from previous user ${event.previousAssignedUserId}`,
            FlowableEventListener.name,
          );
          await this.flowableService.unclaimTask(flowableTask.id);
        }

        this.logger.log(
          `[Flowable-TaskAssigned] Claiming task ${flowableTask.id} for user ${event.assignedUserId}`,
          FlowableEventListener.name,
        );

        await this.flowableService.claimTask(flowableTask.id, event.assignedUserId);
        const variablesToUpdate = {
          assignee_user_id: event.assignedUserId,
          task_status: 'STATUS_10_ASSIGNED',
          reassigned_from: event.previousAssignedUserId || null,
          reassigned_at: new Date().toISOString(),
        };

        this.logger.log(
          `[Flowable-TaskAssigned] Updating task variables: ${JSON.stringify(variablesToUpdate)}`,
          FlowableEventListener.name,
        );

        await this.flowableService.setTaskVariables(flowableTask.id, variablesToUpdate);

        this.logger.log(
          `[Flowable-TaskAssigned] Successfully updated Flowable task ${flowableTask.id}: assigned to ${event.assignedUserId}`,
          FlowableEventListener.name,
        );
      } else {
        this.logger.warn(`[Flowable-TaskAssigned] Flowable task not found for PostgreSQL task ${event.taskId}`, FlowableEventListener.name);
      }
    } catch (error) {
      this.logger.error(
        `[Flowable-TaskAssigned] Failed to update Flowable task assignment: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );
    }
  }

  @OnEvent('task.unassigned')
  async handleTaskUnassigned(event: TaskUnassignedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        return;
      }

      const flowableTasks = await this.flowableService.getProcessTasks(processInstance.id);
      const flowableTask = flowableTasks.find((ft: any) => {
        const vars = ft.variables || [];
        const postgresIdVar = vars.find((v: any) => v.name === 'postgres_task_id');
        return postgresIdVar?.value === event.taskId;
      });

      if (flowableTask) {
        // Unclaim the task in Flowable
        await this.flowableService.unclaimTask(flowableTask.id);

        // Update variables to reflect unassigned state
        const variablesToUpdate = {
          assignee_user_id: null,
          task_status: 'STATUS_01_UNASSIGNED',
          unassigned_from: event.previousAssignedUserId,
          unassigned_at: new Date().toISOString(),
          unassignment_reason: event.reason || 'Task unassigned',
        };

        await this.flowableService.setTaskVariables(flowableTask.id, variablesToUpdate);

        // Ensure the task is added back to the candidate group
        if (event.candidateGroup) {
          await this.flowableService.assignTaskToCandidateGroup(flowableTask.id, event.candidateGroup);
        }

        this.logger.log(
          `Unassigned Flowable task ${flowableTask.id} from user ${event.previousAssignedUserId}`,
          FlowableEventListener.name,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle task unassignment in Flowable: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }

  @OnEvent('case.status.changed')
  async handleCaseStatusChanged(event: CaseStatusChangedEvent) {
    try {
      this.logger.log(
        `[Flowable-CaseStatus] Handling case status change for case ${event.caseId}: ${event.oldStatus} → ${event.newStatus}`,
        FlowableEventListener.name,
      );

      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (!processInstance) {
        this.logger.warn(`[Flowable-CaseStatus] No Flowable process found for case ${event.caseId}`, FlowableEventListener.name);
        return;
      }

      const processVariables = {
        case_status: event.newStatus,
        status_change_reason: event.reason || 'Status updated',
        status_changed_at: new Date().toISOString(),
        previous_status: event.oldStatus,
      };

      this.logger.log(
        `[Flowable-CaseStatus] Updating process ${processInstance.id} variables: ${JSON.stringify(processVariables)}`,
        FlowableEventListener.name,
      );

      await this.flowableService.setProcessVariables(processInstance.id, processVariables);

      this.logger.log(
        `[Flowable-CaseStatus] Successfully updated Flowable process ${processInstance.id} for case ${event.caseId}`,
        FlowableEventListener.name,
      );
    } catch (error) {
      this.logger.error(
        `[Flowable-CaseStatus] Failed to update Flowable process status: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );
    }
  }

  @OnEvent('bpmn.task.created')
  async handleBpmnTaskCreated(event: BpmnTaskCreatedEvent) {
    try {
      this.logger.log(
        `[Flowable-BpmnTaskCreated] Creating PostgreSQL task for BPMN task ${event.flowableTaskId} (${event.taskName})`,
        FlowableEventListener.name,
      );

      const postgresTask = await this.taskService.createTask(
        {
          caseId: event.caseId,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: event.taskName,
          description: event.description,
          candidateGroup: event.candidateGroup,
        },
        'system',
        this.auditLogService,
        this.logger,
      );

      this.logger.log(
        `[Flowable-BpmnTaskCreated] Created PostgreSQL task ${postgresTask.task_id} for BPMN task ${event.flowableTaskId}`,
        FlowableEventListener.name,
      );

      // Get the process instance to add to variables
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      const taskVariables = {
        postgres_task_id: postgresTask.task_id,
        postgres_case_id: event.caseId,
        task_status: TaskStatus.STATUS_01_UNASSIGNED,
        task_name: event.taskName,
        candidate_group: event.candidateGroup,
        flowable_case_id: processInstance?.id || null,
        created_at: new Date().toISOString(),
        created_by: 'system',
      };

      this.logger.log(
        `[Flowable-BpmnTaskCreated] Syncing BPMN task ${event.flowableTaskId} with variables: ${JSON.stringify(taskVariables)}`,
        FlowableEventListener.name,
      );

      const syncSuccess = await this.flowableService.syncTaskWithDatabase(event.flowableTaskId, {
        postgres_task_id: postgresTask.task_id,
        postgres_case_id: event.caseId,
        task_status: TaskStatus.STATUS_01_UNASSIGNED,
        task_name: event.taskName,
        candidate_group: event.candidateGroup,
        flowable_case_id: processInstance?.id,
      });

      if (syncSuccess) {
        this.logger.log(
          `[Flowable-BpmnTaskCreated] Successfully synced BPMN task ${event.flowableTaskId} with PostgreSQL task ${postgresTask.task_id}`,
          FlowableEventListener.name,
        );

        const variables = await this.flowableService.getTaskVariables(event.flowableTaskId);
        this.logger.log(
          `[Flowable-BpmnTaskCreated] Verification - Task ${event.flowableTaskId} now has ${Object.keys(variables).length} variables: ${Object.keys(variables).join(', ')}`,
          FlowableEventListener.name,
        );
      } else {
        this.logger.error(
          `[Flowable-BpmnTaskCreated] Failed to sync variables for BPMN task ${event.flowableTaskId}`,
          FlowableEventListener.name,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Flowable-BpmnTaskCreated] Failed to create PostgreSQL task for BPMN task: ${error.message}`,
        error.stack,
        FlowableEventListener.name,
      );
    }
  }

  @OnEvent('case.abandoned')
  async handleCaseAbandoned(event: CaseAbandonedEvent) {
    try {
      const processInstance = await this.flowableService.getProcessInstanceByBusinessKey(event.caseId);

      if (processInstance) {
        await this.flowableService.terminateProcessInstance(processInstance.id, `Case abandoned: ${event.reason}`);

        this.logger.log(`Terminated Flowable process for abandoned case ${event.caseId}`, FlowableEventListener.name);
      }
    } catch (error) {
      this.logger.error(`Failed to terminate Flowable process: ${error.message}`, error.stack, FlowableEventListener.name);
    }
  }
}
