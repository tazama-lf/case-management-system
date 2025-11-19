import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FlowableTaskService } from './flowable-task.service';
import { FlowableUtilitiesService } from '../utils/flowable-utilities.service';
import { AuditLogService } from '../../audit/auditLog.service';
import { TaskStatus } from '@prisma/client';
import { CaseRepository } from '../../repository/case.repository';
import { TaskRepository } from 'src/modules/repository/task.repository';

/**
 * Service responsible for synchronizing BPMN-created tasks with PostgreSQL
 * Handles bidirectional sync between Flowable workflow engine and database
 */
@Injectable()
export class BpmnSyncService {
  constructor(
    private readonly flowableTaskService: FlowableTaskService,
    private readonly utilitiesService: FlowableUtilitiesService,
    private readonly auditLogService: AuditLogService,
    private readonly caseRepository: CaseRepository,
    private readonly taskRepository: TaskRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Sync all BPMN-created tasks for a case with PostgreSQL
   * @param caseId Case ID to sync tasks for
   * @param processInstanceId Flowable process instance ID
   */
  async syncAllTasksForCase(caseId: string, processInstanceId: string): Promise<void> {
    try {
      const flowableTasks = await this.flowableTaskService.getProcessTasks(processInstanceId);

      this.logger.log(
        `[BPMN-Sync] Found ${flowableTasks.length} Flowable tasks for case ${caseId}`,
        BpmnSyncService.name,
      );

      for (const flowableTask of flowableTasks) {
        await this.syncSingleTask(flowableTask, caseId);
      }

      this.logger.log(
        `[BPMN-Sync] Completed sync for all tasks in case ${caseId}`,
        BpmnSyncService.name,
      );
    } catch (error) {
      this.logger.error(
        `[BPMN-Sync] Failed to sync BPMN tasks for case ${caseId}: ${error.message}`,
        error.stack,
        BpmnSyncService.name,
      );
      throw error;
    }
  }

  /**
   * Sync a single BPMN task with PostgreSQL database
   * Creates database task if not already synced
   * @param flowableTask Flowable task object
   * @param caseId Case ID the task belongs to
   */
  async syncSingleTask(flowableTask: any, caseId: string): Promise<void> {
    const taskId = flowableTask.id;

    try {
      // Check if already synced
      const taskVariables = await this.utilitiesService.getTaskVariables(taskId);

      if (taskVariables.postgres_task_id) {
        const dbTask = await this.taskRepository.findTaskById(taskVariables.postgres_task_id);

        if (dbTask) {
          this.logger.debug(
            `[BPMN-Sync] Task ${taskId} already synced with database task ${dbTask.task_id}`,
            BpmnSyncService.name,
          );
          return;
        } else {
          this.logger.warn(
            `[BPMN-Sync] Flowable task ${taskId} references non-existent database task ${taskVariables.postgres_task_id}`,
            BpmnSyncService.name,
          );
        }
      }

      // Verify case exists
      const dbCase = await this.caseRepository.findCaseById(caseId);

      if (!dbCase) {
        this.logger.error(
          `[BPMN-Sync] Database case ${caseId} not found for Flowable task ${taskId}`,
          BpmnSyncService.name,
        );
        return;
      }

      // Determine candidate group and status
      const candidateGroup = this.utilitiesService.determineCandidateGroup(
        flowableTask.name,
        flowableTask.candidateGroups,
      );

      const taskStatus = flowableTask.assignee
        ? TaskStatus.STATUS_10_ASSIGNED
        : TaskStatus.STATUS_01_UNASSIGNED;

      // Create database task
      const dbTask = await this.utilitiesService.createTask(
        {
          caseId,
          status: taskStatus,
          name: flowableTask.name,
          description: flowableTask.description || `Task created from BPMN: ${flowableTask.name}`,
          candidateGroup,
          assignedUserId: flowableTask.assignee,
        },
        'system',
      );

      // Update Flowable task with database reference
      const variables = {
        postgres_task_id: dbTask.task_id,
        postgres_case_id: caseId,
        task_status: dbTask.status,
        task_name: flowableTask.name,
        candidate_group: dbTask.candidateGroup || '',
      };

      await this.flowableTaskService.setTaskVariables(taskId, variables);

      this.logger.log(
        `[BPMN-Sync] ✓ Synced Flowable task ${taskId} with database task ${dbTask.task_id} for case ${caseId}`,
        BpmnSyncService.name,
      );
    } catch (error) {
      this.logger.error(
        `[BPMN-Sync] Failed to sync Flowable task ${taskId}: ${error.message}`,
        error.stack,
        BpmnSyncService.name,
      );
    }
  }
}
