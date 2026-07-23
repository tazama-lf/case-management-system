import apiClient from '../../../shared/services/apiClient';

export interface CaseHistoryEntry {
  event_log_id: string;
  user_id: string;
  operation: string;
  entity_name: string;
  action_performed: string;
  case_id: number;
  performed_at: Date;
}

export class CaseHistoryService {
  private readonly baseUrl = '/api/v1/case-history';

  // async getCaseHistoryByTask(caseId: number): Promise<TaskHistoryEntry[]> {
  //   try {
  //     const response = await apiClient.get<{
  //       taskHistory: TaskHistoryEntry[];
  //     }>(
  //       `${this.baseUrl}/${caseId}`
  //     );

  //     return response.taskHistory ?? [];

  //   } catch (error) {
  //     console.error('Failed to fetch case history by Task:', error);
  //     return [];
  //   }
  // }

  async getCaseHistory(caseId: number): Promise<CaseHistoryEntry[]> {
    try {
      const response = await apiClient.get<CaseHistoryEntry[]>(
        `${this.baseUrl}/${caseId}`,
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to fetch case history by Case:', error);
      return [];
    }
  }
}

export const caseHistoryService = new CaseHistoryService();
