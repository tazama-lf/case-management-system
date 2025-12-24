import apiClient from '../../../shared/services/apiClient';
import authService from '../../auth/services/authService';
import type {
  FlowableTask,
  UnifiedWorkQueueTask,
  WorkQueueCandidateGroupType,
  FlowableTaskAssignmentRequest,
  FlowableTaskCompletionRequest,
} from '../types/flowable.types';
import { WorkQueueCandidateGroup } from '../types/flowable.types';
import {
  FlowableErrorHandler,
  FlowableError,
} from '../utils/flowableErrorHandler';

export class FlowableWorkQueueService {
  private baseUrl = '/api/v1/task';
  private workQueueUrl = '/api/v1/workqueue';

  async getWorkQueueByGroup(
    candidateGroup: WorkQueueCandidateGroupType,
  ): Promise<UnifiedWorkQueueTask[]> {
    try {
      // For investigators queue, use the new assignee-based endpoint
      if (candidateGroup === WorkQueueCandidateGroup.INVESTIGATORS) {
        return this.getInvestigatorTasks();
      }

      const response = await apiClient.get<{ data: { tasks: FlowableTask[] } }>(
        `${this.baseUrl}/work-queues/${candidateGroup}`,
      );

      const tasks = response.data?.tasks || [];
      const unifiedTasks = tasks.map((task) =>
        this.transformFlowableTask(task, candidateGroup),
      );

      return unifiedTasks;
    } catch (error: any) {
      throw this.handleFlowableError(
        error,
        `get work queue for ${candidateGroup}`,
      );
    }
  }

  async getInvestigatorTasks(): Promise<UnifiedWorkQueueTask[]> {
    try {
      // Get current user from auth service
      const currentUser = authService.getUser();
      if (!currentUser || !currentUser.userId) {
        throw new Error('User not authenticated or user ID not available');
      }

      const response = await apiClient.get<FlowableTask[]>(
        `${this.workQueueUrl}/assignee/${currentUser.userId}/tasks`,
      );

      const tasks = Array.isArray(response) ? response : [];
      const unifiedTasks = tasks.map((task) =>
        this.transformFlowableTaskFromAPI(task),
      );

      return unifiedTasks;
    } catch (error: any) {
      throw this.handleFlowableError(
        error,
        'get investigator tasks by assignee',
      );
    }
  }

  async getAllWorkQueues(): Promise<Record<string, number>> {
    try {
      const queueCounts: Record<string, number> = {};

      const candidateGroups = Object.values(WorkQueueCandidateGroup);

      await Promise.all(
        candidateGroups.map(async (group) => {
          try {
            const tasks = await this.getWorkQueueByGroup(group);
            queueCounts[group] = tasks.length;
          } catch (error) {
            queueCounts[group] = 0;
          }
        }),
      );

      return queueCounts;
    } catch (error: any) {
      throw this.handleFlowableError(error, 'get all work queues');
    }
  }

  async assignTask(
    taskId: number,
    assigneeUserId: string,
    options?: {
      currentUserId?: string;
      isInvestigator?: boolean;
    },
  ): Promise<UnifiedWorkQueueTask> {
    try {
      const assignmentRequest: FlowableTaskAssignmentRequest = {
        assignedUserId: assigneeUserId,
      };

      // Check if this is an investigator self-assigning
      const isSelfAssignment = options?.currentUserId === assigneeUserId;
      const isInvestigator = options?.isInvestigator || false;

      // Use self-assign endpoint for investigators assigning to themselves
      const endpoint =
        isSelfAssignment && isInvestigator
          ? `${this.baseUrl}/${taskId}/self-assign`
          : `${this.baseUrl}/${taskId}/assign`;

      const response = await apiClient.patch<FlowableTask>(
        endpoint,
        assignmentRequest,
      );

      return this.transformFlowableTask(response);
    } catch (error: any) {
      // If task not found with PostgreSQL ID, it might be a data sync issue
      if (error.response?.status === 404) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(
          `Task assignment failed: ${errorMessage}. This task may only exist in Flowable and needs to be synced to the database.`,
        );
      }
      throw this.handleFlowableError(error, `assign task ${taskId}`);
    }
  }

  async unassignTask(taskId: number): Promise<UnifiedWorkQueueTask> {
    try {
      const assignmentRequest: FlowableTaskAssignmentRequest = {
        assignedUserId: '',
      };

      const response = await apiClient.patch<FlowableTask>(
        `${this.baseUrl}/${taskId}/unassign`,
        assignmentRequest,
      );

      return this.transformFlowableTask(response);
    } catch (error: any) {
      throw this.handleFlowableError(error, `unassign task ${taskId}`);
    }
  }

  async completeTask(taskId: number, data: { notes?: string }): Promise<void> {
    try {
      const completionRequest: FlowableTaskCompletionRequest = {
        variables: {
          notes: data.notes || '',
        },
      };

      await apiClient.post(
        `${this.baseUrl}/${taskId}/complete`,
        completionRequest,
      );
    } catch (error: any) {
      throw this.handleFlowableError(error, `complete task ${taskId}`);
    }
  }

  async getTaskDetails(taskId: number): Promise<UnifiedWorkQueueTask> {
    try {
      const response = await apiClient.get<FlowableTask>(
        `${this.baseUrl}/${taskId}`,
      );
      return this.transformFlowableTask(response);
    } catch (error: any) {
      throw this.handleFlowableError(error, `get task details for ${taskId}`);
    }
  }

  private transformFlowableTask(
    flowableTask: any,
    candidateGroup?: string,
  ): UnifiedWorkQueueTask {
    // Extract PostgreSQL task ID from variables, fallback to Flowable ID
    const postgresTaskId =
      flowableTask.variables?.postgres_task_id ||
      flowableTask.processVariables?.postgresTaskId ||
      flowableTask.variables?.taskId;

    const postgresCaseId =
      flowableTask.variables?.postgres_case_id ||
      flowableTask.processVariables?.caseId ||
      flowableTask.variables?.caseId;

    return {
      id: postgresTaskId || flowableTask.id, // Use PostgreSQL task ID for operations
      taskId: postgresTaskId || flowableTask.id,
      flowableTaskId: flowableTask.id, // Keep Flowable ID for reference
      name: flowableTask.name,
      description: flowableTask.description,

      assignee: flowableTask.assignee,
      assigneeName: flowableTask.assignee,
      candidateGroup:
        candidateGroup ||
        flowableTask.candidateGroup ||
        flowableTask.candidateGroups?.[0],

      status: this.mapFlowableStatus(flowableTask),
      priority: this.mapFlowablePriority(flowableTask.priority),

      createdAt: flowableTask.createTime || new Date().toISOString(),
      dueDate: flowableTask.dueDate,

      processInstanceId: flowableTask.processInstanceId || '',
      caseId: postgresCaseId,

      flowableData: flowableTask,
    };
  }

  private transformFlowableTaskFromAPI(
    flowableTask: any,
  ): UnifiedWorkQueueTask {
    // For the new API response format
    // Extract case ID from processInstanceId or other available fields
    const caseId = flowableTask.processInstanceId || flowableTask.id;

    return {
      id: flowableTask.id,
      taskId: flowableTask.id,
      flowableTaskId: flowableTask.id,
      name: flowableTask.name,
      description: flowableTask.description,

      assignee: flowableTask.assignee,
      assigneeName: flowableTask.assignee,
      candidateGroup: 'investigators',

      status: this.mapFlowableStatus(flowableTask),
      priority: this.mapFlowablePriority(flowableTask.priority),

      createdAt: flowableTask.createTime || new Date().toISOString(),
      dueDate: flowableTask.dueDate,

      processInstanceId: flowableTask.processInstanceId || '',
      caseId: caseId,

      flowableData: flowableTask,
    };
  }

  private mapFlowableStatus(
    task: any,
  ): 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' {
    const taskStatus = task.variables?.task_status;
    if (taskStatus) {
      switch (taskStatus) {
        case 'STATUS_01_UNASSIGNED':
          return 'UNASSIGNED';
        case 'STATUS_10_ASSIGNED':
          return 'ASSIGNED';
        case 'STATUS_20_IN_PROGRESS':
          return 'IN_PROGRESS';
        case 'STATUS_30_COMPLETED':
          return 'COMPLETED';
        case 'STATUS_21_BLOCKED':
          return 'SUSPENDED';
      }
    }

    if (task.suspended) return 'SUSPENDED';
    if (!task.assignee) return 'UNASSIGNED';
    if (task.assignee) return 'ASSIGNED';
    return 'IN_PROGRESS';
  }

  private mapFlowablePriority(
    priority: number,
  ): 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH' {
    if (priority >= 90) return 'BREACH';
    if (priority >= 70) return 'CRITICAL';
    if (priority >= 50) return 'URGENT';
    return 'NEW';
  }

  private handleFlowableError(error: any, operation: string): FlowableError {
    return FlowableErrorHandler.parseError(error, operation);
  }

  getCandidateGroups(
    isInvestigator?: boolean,
    isSupervisor?: boolean,
  ): Array<{ value: WorkQueueCandidateGroupType; label: string }> {
    const allGroups = [
      {
        value: WorkQueueCandidateGroup.INVESTIGATIONS,
        label: 'Investigations Queue',
      },
      {
        value: WorkQueueCandidateGroup.INVESTIGATORS,
        label: 'Investigators Queue',
      },
      {
        value: WorkQueueCandidateGroup.SUPERVISORS,
        label: 'Supervisors Queue',
      },
      {
        value: WorkQueueCandidateGroup.COMPLIANCE_OFFICERS,
        label: 'Compliance Officers Queue',
      },
    ];

    if (isSupervisor) {
      return allGroups;
    }

    // Filter to investigations and investigators queues for investigators
    if (isInvestigator) {
      return allGroups.filter(
        (group) =>
          group.value === WorkQueueCandidateGroup.INVESTIGATIONS ||
          group.value === WorkQueueCandidateGroup.INVESTIGATORS,
      );
    }
    // return allGroups.slice(0, 2);
    return allGroups;
  }
}

export const flowableWorkQueueService = new FlowableWorkQueueService();

export { flowableWorkQueueService as workQueueService };
export type { UnifiedWorkQueueTask as WorkQueueTask };
