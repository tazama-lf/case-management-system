import apiClient from '@/shared/services/apiClient';

export interface WorkQueueResponseDto {
  workQueueId: string;
  name: string;
  description: string;
  tenantId: string;
  isActive: boolean;
  createdByUserId: string;
  roles: string[];
  taskTypes: string[];
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkQueueListResponseDto {
  data: WorkQueueResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetWorkQueuesParams {
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class WorkQueueService {
  private readonly baseEndpoint = '/api/v1/work-queues';

  async getAllWorkQueues(params?: GetWorkQueuesParams): Promise<WorkQueueListResponseDto> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      if (params.role) queryParams.append('role', params.role);
      if (params.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
      if (params.page) queryParams.append('page', String(params.page));
      if (params.limit) queryParams.append('limit', String(params.limit));
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    }

    const queryString = queryParams.toString();
    const endpoint = queryString ? `${this.baseEndpoint}?${queryString}` : this.baseEndpoint;

    return apiClient.get<WorkQueueListResponseDto>(endpoint);
  }


  async getWorkQueueById(workQueueId: string): Promise<WorkQueueResponseDto> {
    return apiClient.get<WorkQueueResponseDto>(`${this.baseEndpoint}/${workQueueId}`);
  }


  async createWorkQueue(data: Partial<WorkQueueResponseDto>): Promise<WorkQueueResponseDto> {
    return apiClient.post<WorkQueueResponseDto>(this.baseEndpoint, data);
  }

  async updateWorkQueue(workQueueId: string, data: Partial<WorkQueueResponseDto>): Promise<WorkQueueResponseDto> {
    return apiClient.put<WorkQueueResponseDto>(`${this.baseEndpoint}/${workQueueId}`, data);
  }

  async deleteWorkQueue(workQueueId: string): Promise<void> {
    return apiClient.delete<void>(`${this.baseEndpoint}/${workQueueId}`);
  }
}

const workQueueService = new WorkQueueService();
export default workQueueService;
