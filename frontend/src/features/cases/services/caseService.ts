import apiClient from '../../../shared/services/apiClient';
import type { Case, ApiErrorResponse } from '../../alerts/types/triage.types';

export class CaseService {
  private baseUrl = '/api/v1/cases';

  // GET /api/v1/cases/:caseId
  async getCaseDetails(caseId: string): Promise<Case> {
    try {
      const response = await apiClient.get<Case>(`${this.baseUrl}/${caseId}`);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'get case details');
    }
  }

  private validateCaseResponse(data: unknown): Case {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid case data received');
    }

    const d = data as { case_id?: unknown };
    if (!d.case_id) {
      throw new Error('Case ID is missing from response');
    }

    return data as Case;
  }

  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      return new Error(apiError.message || `Failed to ${operation}`);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const caseService = new CaseService();
