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
      const response = await apiClient.get<FlowableTask[]>(`${this.baseUrl}/work-queues/${candidateGroup}`);
      
      const unifiedTasks = response.map((task) => this.transformFlowableTask(task));
      
      return unifiedTasks;
    } catch (error: any) {
      throw this.handleFlowableError(error, `get work queue for ${candidateGroup}`);
    }
  }

  /**
   * Get all available work queues with task counts
   */
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
    // Add validation to check if taskId and assigneeUserId are valid
    if (!taskId) {
      throw new Error('Task ID is required for assignment');
    }
    
    if (!assigneeUserId) {
      throw new Error('Assignee user ID is required for assignment');
    }

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
   * Unassign a task 
   */
  async unassignTask(taskId: string): Promise<UnifiedWorkQueueTask> {
    try {
      const assignmentRequest: FlowableTaskAssignmentRequest = {
        assignee: '' 
      };
      
      const response = await apiClient.patch<FlowableTask>(
        `${this.baseUrl}/${taskId}/assign`, 
        assignmentRequest
      );
      
      return this.transformFlowableTask(response);
    } catch (error: any) {
      throw this.handleFlowableError(error, `unassign task ${taskId}`);
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, data: { notes?: string }): Promise<void> {
    try {
      const completionRequest: FlowableTaskCompletionRequest = {
        variables: {
          notes: data.notes || ''
        }
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
  private transformFlowableTask(flowableTask: any): UnifiedWorkQueueTask {
    return {
      id: flowableTask.flowableTaskId || flowableTask.id,
      taskId: flowableTask.flowableTaskId || flowableTask.id, // For compatibility
      name: flowableTask.name,
      description: flowableTask.description,
      
      // Assignment
      assignee: flowableTask.assignee,
      assigneeName: flowableTask.assignee, // Could be enhanced with user lookup
      candidateGroup: flowableTask.candidateGroup || flowableTask.candidateGroups?.[0],
      
      // Status mapping
      status: this.mapFlowableStatus(flowableTask),
      priority: this.mapFlowablePriority(flowableTask.priority),
      
      // Timestamps
      createdAt: flowableTask.createTime || new Date().toISOString(),
      dueDate: flowableTask.dueDate,
      
      // Process context
      processInstanceId: flowableTask.processInstanceId || '',
      caseId: flowableTask.variables?.postgres_case_id || flowableTask.processVariables?.caseId,
      
      // Keep original Flowable data for advanced operations
      flowableData: flowableTask
    };
  }

  /**
   * Map Flowable task state to unified status
   */
  private mapFlowableStatus(task: any): 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' {
    // Check for task_status in variables first
    const taskStatus = task.variables?.task_status;
    if (taskStatus) {
      switch (taskStatus) {
        case 'STATUS_01_UNASSIGNED': return 'UNASSIGNED';
        case 'STATUS_10_ASSIGNED': return 'ASSIGNED';
        case 'STATUS_20_IN_PROGRESS': return 'IN_PROGRESS';
        case 'STATUS_30_COMPLETED': return 'COMPLETED';
        case 'STATUS_21_BLOCKED': return 'SUSPENDED';
      }
    }
    
    // Fallback to standard Flowable status logic
    if (task.suspended) return 'SUSPENDED';
    if (!task.assignee) return 'UNASSIGNED';
    if (task.assignee) return 'ASSIGNED';
    return 'IN_PROGRESS'; // Default fallback
  }

  /**
   * Map Flowable priority number to string
   */
  private mapFlowablePriority(priority: number): 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH' {
    if (priority >= 90) return 'BREACH';
    if (priority >= 70) return 'CRITICAL';
    if (priority >= 50) return 'URGENT';
    return 'NEW';
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
      { value: WorkQueueCandidateGroup.INVESTIGATIONS, label: 'Investigations Queue' },
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