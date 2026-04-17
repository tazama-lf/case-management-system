import apiClient from '../../../shared/services/apiClient';
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
  private readonly baseUrl = '/api/v1/task-history';

  async getCaseHistory(caseId: number): Promise<TaskHistoryEntry[]> {
    try {
      const response = await apiClient.get<{
        taskHistory: TaskHistoryEntry[];
      }>(`${this.baseUrl}/${caseId}`);

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to fetch case history by Task:', error);
      return [];
    }
  }

}

export const taskHistoryService = new TaskHistoryService();
