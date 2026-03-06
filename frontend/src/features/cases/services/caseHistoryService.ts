import apiClient from '../../../shared/services/apiClient';
// import type { ApiErrorResponse } from '../../alerts/types/triage.types';

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

  // handleError is unused but kept for future error handling needs
  // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members -- Reserved for future use
  // private static handleError(error: unknown, operation: string): Error {
  //   if (
  //     typeof error === 'object' &&
  //     error !== null &&
  //     'response' in error &&
  //     typeof (error as { response?: unknown }).response === 'object' &&
  //     (error as { response?: { data?: ApiErrorResponse } }).response?.data
  //   ) {
  //     const apiError = (error as { response: { data: ApiErrorResponse } }).response.data;
  //     return new Error(apiError.message || `Failed to ${operation}`);
  //   }
  //   if (error instanceof Error) {
  //     return new Error(`Failed to ${operation}: ${error.message}`);
  //   }
  //   return new Error(`Failed to ${operation}`);
  // }
}

export const caseHistoryService = new CaseHistoryService();
