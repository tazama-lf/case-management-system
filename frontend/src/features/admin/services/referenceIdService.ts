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
    } catch (error: any) {
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
    } catch (error: any) {
      throw this.handleError(error, 'create reference id');
    }
  }

  private handleError(error: any, operation: string): Error {
    console.error(`ReferenceIdService Error - ${operation}:`, error);

    if (error.response?.data) {
      const apiError = error.response.data;
      return new Error(apiError.message || `Failed to ${operation}`);
    }

    if (error.message) {
      return new Error(error.message);
    }

    return new Error(`Failed to ${operation}`);
  }
}

const referenceIdService = new ReferenceIdService();
export default referenceIdService;
