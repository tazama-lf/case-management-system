import apiClient from '../../../shared/services/apiClient';
import type { Case, ApiErrorResponse } from '../../alerts/types/triage.types';

// Backend DTO types matching the API
export interface GetUserCasesQueryDto {
  status?: string;
  priority?: string;
  includeTaskAssignments?: boolean;
  includeOwnedCases?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserTaskDto {
  task_id: string;
  name: string;
  status: string;
  created_at: Date;
}

export interface AlertInfoDto {
  alert_id: string;
  message: string;
  confidence_per: number;
}

export interface CaseWithTasksDto {
  case_id: string;
  status: string;
  priority: string;
  case_type: string;
  created_at: Date;
  updated_at: Date;
  user_role: 'owner' | 'task_assignee' | 'both';
  user_tasks: UserTaskDto[];
  total_tasks: number;
  alert?: AlertInfoDto;
}

export interface PaginationDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SummaryStatisticsDto {
  totalOwnedCases: number;
  totalTaskAssignments: number;
  casesByStatus: Record<string, number>;
  casesByPriority: Record<string, number>;
}

export interface GetUserCasesResponseDto {
  cases: CaseWithTasksDto[];
  pagination: PaginationDto;
  summary: SummaryStatisticsDto;
}

export interface UserWorkloadStatsDto {
  totalActiveCases: number;
  totalPendingTasks: number;
  casesByStatus: Record<string, number>;
  casesByPriority: Record<string, number>;
  oldestCase?: {
    case_id: string;
    created_at: string;
    days_old: number;
  };
  averageCaseAge: number;
}

// Close Case DTOs matching backend
export interface CloseCaseDto {
  recommendedOutcome: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE';
  finalNotes?: string;
  recommendations?: string;
}

// Manual Case Creation DTOs matching backend ManualCreateCaseDto
export interface ManualCreateCaseDto {
  alertId?: string;
  priorityScore?: number;
  alertType: string;
}

// Update Case DTO for completing draft cases
export interface UpdateCaseDto {
  status?: string;
  priority?: string;
  caseType?: string;
  caseOwnerUserId?: string;
}

// Abandon Case DTO
export interface AbandonCaseDto {
  reason: string;
}

export interface CloseCaseResponseDto {
  message: string;
  closed_case: {
    case_id: string;
    status: string;
    updated_at: string;
  };
  approval_task: {
    task_id: string;
    name: string;
    status: string;
    assigned_to: string;
  };
  processInstanceId: string;
}

export class CaseService {
  private baseUrl = '/api/v1/cases';

  // GET /api/v1/cases/user/assigned
  async getUserCases(query?: GetUserCasesQueryDto): Promise<GetUserCasesResponseDto> {
    try {
      const params = new URLSearchParams();
      
      // Set defaults to get all cases assigned to current user
      const includeTaskAssignments = query?.includeTaskAssignments ?? true;
      const includeOwnedCases = query?.includeOwnedCases ?? true;
      
      if (query?.status) params.append('status', query.status);
      if (query?.priority) params.append('priority', query.priority);
      params.append('includeTaskAssignments', String(includeTaskAssignments));
      params.append('includeOwnedCases', String(includeOwnedCases));
      if (query?.page) params.append('page', String(query.page));
      if (query?.limit) params.append('limit', String(query.limit));
      if (query?.sortBy) params.append('sortBy', query.sortBy);
      if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

      const queryString = params.toString();
      const url = `${this.baseUrl}/user/assigned${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<GetUserCasesResponseDto>(url);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get user cases');
    }
  }

  // GET /api/v1/cases/user/workload
  async getUserWorkloadStats(): Promise<UserWorkloadStatsDto> {
    try {
      const response = await apiClient.get<UserWorkloadStatsDto>(`${this.baseUrl}/user/workload`);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get user workload stats');
    }
  }

  // GET /api/v1/cases/:caseId
  async getCaseDetails(caseId: string): Promise<Case> {
    try {
      const response = await apiClient.get<Case>(`${this.baseUrl}/${caseId}`);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'get case details');
    }
  }

  // PUT /api/v1/cases/:caseId/close
  async closeCase(caseId: string, closeCaseData: CloseCaseDto): Promise<CloseCaseResponseDto> {
    try {
      const response = await apiClient.put<CloseCaseResponseDto>(`${this.baseUrl}/${caseId}/close`, closeCaseData);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'close case');
    }
  }

  // POST /api/v1/cases/manual - Manual case creation
  async createCase(manualCreateCaseData: ManualCreateCaseDto): Promise<Case> {
    try {
      const response = await apiClient.post<Case>(`${this.baseUrl}/manual`, manualCreateCaseData);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'create case');
    }
  }

  // PUT /api/v1/cases/:caseId 
  async updateCase(caseId: string, updateCaseData: UpdateCaseDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}`, updateCaseData);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'update case');
    }
  }

  // PUT /api/v1/cases/:caseId/abandon - Abandon a case
  async abandonCase(caseId: string, abandonCaseData: AbandonCaseDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/abandon`, abandonCaseData);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'abandon case');
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

  // GET /api/v1/cases/user/assigned - Get cases assigned to current user
  async getUserAssignedCases(query?: GetUserCasesQueryDto): Promise<{ cases: CaseWithTasksDto[]; pagination?: any }> {
    try {
      const params = new URLSearchParams();
      
      if (query?.status) params.append('status', query.status);
      if (query?.priority) params.append('priority', query.priority);
      if (query?.includeTaskAssignments) params.append('includeTaskAssignments', String(query.includeTaskAssignments));
      if (query?.includeOwnedCases) params.append('includeOwnedCases', String(query.includeOwnedCases));
      if (query?.page) params.append('page', String(query.page));
      if (query?.limit) params.append('limit', String(query.limit));
      if (query?.sortBy) params.append('sortBy', query.sortBy);
      if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

      const queryString = params.toString();
      const url = `${this.baseUrl}/user/assigned${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<{ cases: CaseWithTasksDto[]; pagination?: any }>(url);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get user assigned cases');
    }
  }

  // GET /api/v1/cases/all - Get all cases in the system (requires supervisor role)
  async getAllCases(query?: GetUserCasesQueryDto): Promise<{ cases: CaseWithTasksDto[]; pagination?: any }> {
    try {
      const params = new URLSearchParams();
      
      if (query?.status) params.append('status', query.status);
      if (query?.priority) params.append('priority', query.priority);
      if (query?.page) params.append('page', String(query.page));
      if (query?.limit) params.append('limit', String(query.limit));
      if (query?.sortBy) params.append('sortBy', query.sortBy);
      if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

      const queryString = params.toString();
      const url = `${this.baseUrl}/all${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<{ cases: CaseWithTasksDto[]; pagination?: any }>(url);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get all cases');
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

export const caseService = new CaseService();
