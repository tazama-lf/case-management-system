import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';

export interface TaskHistoryEntry {
  event_log_id: string;
  user_id: string;
  operation: string;
  entity_name: string;
  action_performed: string;
  case_id: number;
  performed_at: Date;
  task_id: number;
}


export class TaskHistoryService {
  private baseUrl = '/api/v1/task-history';



  async getCaseHistory(caseId: number): Promise<TaskHistoryEntry[]> {
    try {
      const response = await apiClient.get<{
        taskHistory: TaskHistoryEntry[];
      }>(
        `${this.baseUrl}/${caseId}`
      );

      return Array.isArray(response) ? response : [];


    } catch (error) {
      console.error('Failed to fetch case history by Task:', error);
      return [];
    }
  }


  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      return new Error(apiError.message || `Failed to ${operation}`);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const taskHistoryService = new TaskHistoryService();
