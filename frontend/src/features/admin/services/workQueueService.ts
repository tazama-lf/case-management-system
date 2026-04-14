import apiClient from '@/shared/services/apiClient';
import type {
  CandidateGroupData,
  CreateCandidateGroupRequest,
} from '../types/admindashboard.types';

interface CandidateGroupsParams {
  size?: number;
  start?: number;
}

interface CandidateGroupsResponse {
  items: CandidateGroupData[];
  totalCount: number;
}

class WorkQueueService {
  private readonly baseEndpoint = '/api/v1/workqueue';

  async getCandidateGroups(
    params?: CandidateGroupsParams,
  ): Promise<CandidateGroupsResponse> {
    try {
      const searchParams = new URLSearchParams();
      // Always include size and start parameters
      searchParams.append('size', (params?.size ?? 10).toString());
      searchParams.append('start', (params?.start ?? 0).toString());

      const url = `${this.baseEndpoint}/candidate-groups?${searchParams.toString()}`;
      const response = await apiClient.get<CandidateGroupData[]>(url);

      // For now, we'll return the array as items and calculate totalCount
      // When the backend is updated to return pagination info, we can update this
      return {
        items: response,
        totalCount: response.length,
      };
    } catch (error: unknown) {
      throw this.handleError(error, 'get candidate groups');
    }
  }

  async createCandidateGroup(
    data: CreateCandidateGroupRequest,
  ): Promise<CandidateGroupData> {
    try {
      const response = await apiClient.post<CandidateGroupData>(
        `${this.baseEndpoint}/candidate-group`,
        data,
      );
      return response;
    } catch (error: unknown) {
      throw this.handleError(error, 'create candidate group');
    }
  }

  private handleError(error: unknown, operation: string): Error {
    console.error(`WorkQueueService Error - ${operation}:`, error);

    if (error.response?.data) {
      const apiError = error.response.data;
      return new Error(apiError.message ?? `Failed to ${operation}`);
    }

    if (error.message) {
      return new Error(error.message);
    }

    return new Error(`Failed to ${operation}`);
  }
}

const workQueueService = new WorkQueueService();
export default workQueueService;
