import apiClient from '../../../shared/services/apiClient';
import type { 
  FlowableTask, 
  UnifiedWorkQueueTask,
  WorkQueueCandidateGroupType,
  FlowableTaskAssignmentRequest,
  FlowableTaskCompletionRequest
} from '../types/flowable.types';
import { WorkQueueCandidateGroup } from '../types/flowable.types';
import { FlowableErrorHandler, FlowableError } from '../utils/flowableErrorHandler';

/**
 * Enhanced Work Queue Service with Flowable BPM Integration
 */
export class FlowableWorkQueueService {
  private baseUrl = '/api/v1/task';

  /**
   * Get tasks by candidate group using new Flowable endpoint
   * Uses: GET /api/v1/task/work-queues/{candidateGroup}
   */
  async getWorkQueueByGroup(candidateGroup: WorkQueueCandidateGroupType): Promise<UnifiedWorkQueueTask[]> {
    try {
      console.log(`Fetching work queue for candidate group: ${candidateGroup}`);
      
      const response = await apiClient.get<FlowableTask[]>(`${this.baseUrl}/work-queues/${candidateGroup}`);
      
      // Transform Flowable tasks to unified format
      const unifiedTasks = response.map((task) => this.transformFlowableTask(task));
      
      console.log(`Retrieved ${unifiedTasks.length} tasks from ${candidateGroup} queue`);
      return unifiedTasks;
    } catch (error: any) {
      console.error(`Failed to get work queue for ${candidateGroup}:`, error);
      throw this.handleFlowableError(error, `get work queue for ${candidateGroup}`);
    }
  }

  /**
   * Get all available work queues with task counts
   */
  async getAllWorkQueues(): Promise<Record<string, number>> {
    try {
      const queueCounts: Record<string, number> = {};
      
      // Fetch task counts for each candidate group
      const candidateGroups = Object.values(WorkQueueCandidateGroup);
      
      await Promise.all(
        candidateGroups.map(async (group) => {
          try {
            const tasks = await this.getWorkQueueByGroup(group);
            queueCounts[group] = tasks.length;
          } catch (error) {
            console.warn(`Failed to get count for ${group}:`, error);
            queueCounts[group] = 0;
          }
        })
      );
      
      return queueCounts;
    } catch (error: any) {
      throw this.handleFlowableError(error, 'get all work queues');
    }
  }

  /**
   * Assign a task to a user
   */
  async assignTask(taskId: string, assigneeUserId: string): Promise<UnifiedWorkQueueTask> {
    try {
      const assignmentRequest: FlowableTaskAssignmentRequest = {
        assignee: assigneeUserId
      };
      
      const response = await apiClient.patch<FlowableTask>(
        `${this.baseUrl}/${taskId}/assign`, 
        assignmentRequest
      );
      
      return this.transformFlowableTask(response);
    } catch (error: any) {
      throw this.handleFlowableError(error, `assign task ${taskId}`);
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, variables?: Record<string, any>): Promise<void> {
    try {
      const completionRequest: FlowableTaskCompletionRequest = {
        variables: variables || {}
      };
      
      await apiClient.post(`${this.baseUrl}/${taskId}/complete`, completionRequest);
    } catch (error: any) {
      throw this.handleFlowableError(error, `complete task ${taskId}`);
    }
  }

  /**
   * Get task details by ID
   */
  async getTaskDetails(taskId: string): Promise<UnifiedWorkQueueTask> {
    try {
      const response = await apiClient.get<FlowableTask>(`${this.baseUrl}/${taskId}`);
      return this.transformFlowableTask(response);
    } catch (error: any) {
      throw this.handleFlowableError(error, `get task details for ${taskId}`);
    }
  }

  /**
   * Transform Flowable task to unified format
   */
  private transformFlowableTask(flowableTask: FlowableTask): UnifiedWorkQueueTask {
    return {
      id: flowableTask.id,
      taskId: flowableTask.id, // For compatibility
      name: flowableTask.name,
      description: flowableTask.description,
      
      // Assignment
      assignee: flowableTask.assignee,
      assigneeName: flowableTask.assignee, // Could be enhanced with user lookup
      candidateGroup: flowableTask.candidateGroups?.[0],
      
      // Status mapping
      status: this.mapFlowableStatus(flowableTask),
      priority: this.mapFlowablePriority(flowableTask.priority),
      
      // Timestamps
      createdAt: flowableTask.createTime,
      dueDate: flowableTask.dueDate,
      
      // Process context
      processInstanceId: flowableTask.processInstanceId,
      caseId: flowableTask.processVariables?.caseId,
      
      // Keep original Flowable data for advanced operations
      flowableData: flowableTask
    };
  }

  /**
   * Map Flowable task state to unified status
   */
  private mapFlowableStatus(task: FlowableTask): 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' {
    if (task.suspended) return 'SUSPENDED';
    if (!task.assignee) return 'UNASSIGNED';
    if (task.assignee) return 'ASSIGNED';
    return 'IN_PROGRESS'; // Default fallback
  }

  /**
   * Map Flowable priority number to string
   */
  private mapFlowablePriority(priority: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (priority >= 80) return 'CRITICAL';
    if (priority >= 60) return 'HIGH';
    if (priority >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Enhanced error handling for Flowable-specific errors using centralized handler
   */
  private handleFlowableError(error: any, operation: string): FlowableError {
    return FlowableErrorHandler.parseError(error, operation);
  }

  /**
   * Get available candidate groups with proper labels
   */
  getCandidateGroups(): Array<{ value: WorkQueueCandidateGroupType; label: string }> {
    return [
      { value: WorkQueueCandidateGroup.INVESTIGATORS, label: 'Investigators Queue' },
      { value: WorkQueueCandidateGroup.SUPERVISORS, label: 'Supervisors Queue' }
    ];
  }
}

// Export singleton instance
export const flowableWorkQueueService = new FlowableWorkQueueService();

// Backward compatibility exports
export { flowableWorkQueueService as workQueueService };
export type { UnifiedWorkQueueTask as WorkQueueTask };