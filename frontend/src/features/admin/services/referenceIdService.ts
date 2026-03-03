import apiClient from '@/shared/services/apiClient';
import type {
  ReferenceIdsData,
  ReferenceIdsRequest,
} from '../types/admindashboard.types';

interface ReferenceIdsResponse {
  items: ReferenceIdsData[];
  totalCount: number;
}

class ReferenceIdService {
  private readonly baseEndpoint = '/admin';

  async getReferenceIds(): Promise<ReferenceIdsResponse> {
    try {
      const url = `${this.baseEndpoint}/referencesIds/all`;
      const response = await apiClient.get<ReferenceIdsData[]>(url);

      return {
        items: response,
        totalCount: response.length,
      };
    } catch (error: unknown) {
      throw this.handleError(error, 'get reference ids');
    }
  }

  async createReferenceIds(
    data: ReferenceIdsRequest,
  ): Promise<ReferenceIdsResponse> {
    try {
      const response = await apiClient.post<ReferenceIdsResponse>(
        `${this.baseEndpoint}/reference-id`,
        data,
      );
      return response;
    } catch (error: unknown) {
      throw this.handleError(error, 'create reference id');
    }
  }

  private handleError(error: unknown, operation: string): Error {
    console.error(`ReferenceIdService Error - ${operation}:`, error);

    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { data?: { message?: string } } }).response?.data
    ) {
      const apiError = (error as { response: { data: { message?: string } } }).response.data;
      return new Error(apiError.message ?? `Failed to ${operation}`);
    }

    if (error instanceof Error) {
      return new Error(error.message);
    }

    return new Error(`Failed to ${operation}`);
  }
}

const referenceIdService = new ReferenceIdService();
export default referenceIdService;
