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

export interface CreateCandidateGroupRequest {
  groupId: string;
  groupName: string;
  groupType: string;
}

export interface CandidateGroupData {
  id: string;
  url: string;
  name: string;
  type: string;
}

class WorkQueueService {
  private readonly baseEndpoint = '/api/v1/workqueue';

  async getAllWorkQueues(params?: GetWorkQueuesParams): Promise<WorkQueueListResponseDto> {
    // const queryParams = new URLSearchParams();
    
    // if (params) {
    //   if (params.role) queryParams.append('role', params.role);
    //   if (params.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
    //   if (params.page) queryParams.append('page', String(params.page));
    //   if (params.limit) queryParams.append('limit', String(params.limit));
    //   if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    //   if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    // }

    // const queryString = queryParams.toString();
    // const endpoint = queryString ? `${this.baseEndpoint}?${queryString}` : this.baseEndpoint;

    // return apiClient.get<WorkQueueListResponseDto>(endpoint);
    
    // Temporary mock data for admin functionality
    return Promise.resolve({
      data: [],
      total: 0,
      page: params?.page || 1,
      limit: params?.limit || 10,
      totalPages: 0
    });
  }


  async getWorkQueueById(workQueueId: string): Promise<WorkQueueResponseDto> {
    // return apiClient.get<WorkQueueResponseDto>(`${this.baseEndpoint}/${workQueueId}`);
    
    // Temporary mock data
    return Promise.resolve({
      workQueueId,
      name: 'Mock Work Queue',
      description: 'Temporary mock work queue',
      tenantId: 'DEFAULT',
      isActive: true,
      createdByUserId: 'mock-user',
      roles: [],
      taskTypes: [],
      taskCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }


  async createCandidateGroup(data: CreateCandidateGroupRequest): Promise<CandidateGroupData> {
    try {
      const response = await apiClient.post<CandidateGroupData>(`${this.baseEndpoint}/candidate-group`, data);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'create candidate group');
    }
  }

  async createWorkQueue(data: Partial<WorkQueueResponseDto>): Promise<WorkQueueResponseDto> {
    // return apiClient.post<WorkQueueResponseDto>(this.baseEndpoint, data);
    
    // Temporary mock response
    return Promise.resolve({
      workQueueId: 'mock-' + Date.now(),
      name: data.name || 'New Work Queue',
      description: data.description || 'New work queue description',
      tenantId: data.tenantId || 'DEFAULT',
      isActive: data.isActive ?? true,
      createdByUserId: data.createdByUserId || 'mock-user',
      roles: data.roles || [],
      taskTypes: data.taskTypes || [],
      taskCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async updateWorkQueue(workQueueId: string, data: Partial<WorkQueueResponseDto>): Promise<WorkQueueResponseDto> {
    // return apiClient.put<WorkQueueResponseDto>(`${this.baseEndpoint}/${workQueueId}`, data);
    
    // Temporary mock response
    return Promise.resolve({
      workQueueId,
      name: data.name || 'Updated Work Queue',
      description: data.description || 'Updated work queue description',
      tenantId: data.tenantId || 'DEFAULT',
      isActive: data.isActive ?? true,
      createdByUserId: data.createdByUserId || 'mock-user',
      roles: data.roles || [],
      taskTypes: data.taskTypes || [],
      taskCount: data.taskCount || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async deleteWorkQueue(workQueueId: string): Promise<void> {
    // return apiClient.delete<void>(`${this.baseEndpoint}/${workQueueId}`);
    
    // Temporary mock response - just resolve without error
    return Promise.resolve();
  }

  private handleError(error: any, operation: string): Error {
    console.error(`WorkQueueService Error - ${operation}:`, error);
    
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

const workQueueService = new WorkQueueService();
export default workQueueService;
