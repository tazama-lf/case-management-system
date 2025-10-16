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

// Resume Case DTO
export interface ResumeCaseDto {
  reason: string;
}

// Reject Case DTO
export interface RejectCaseDto {
  rejectionReason: string;
}

// Reopen Case DTO
export interface ReopenCaseDto {
  reason: string;
}

// Suspend Case DTO
export interface SuspendCaseDto {
  reason: string;
}

// Approve Case Closure DTO
export interface ApproveCaseClosureDto {
  finalOutcome: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE';
  supervisorComments?: string;
}

// Return Case For Review DTO
export interface ReturnCaseForReviewDto {
  reviewComments: string;
}

// Reject Case Creation DTO
export interface RejectCaseCreationDto {
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

  // POST /api/v1/cases/:caseId 
  async updateCase(caseId: string, updateCaseData: UpdateCaseDto): Promise<Case> {
    try {
      const response = await apiClient.post<Case>(`${this.baseUrl}/${caseId}`, updateCaseData);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'update case');
    }
  }

  // PUT /api/v1/cases/:caseId/suspend - Suspend a case
  async suspendCase(caseId: string, suspendCaseData: SuspendCaseDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/suspend`, suspendCaseData);
      // Backend returns { success: true, case: Case, task: Task }
      // Extract the case object from the response
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'suspend case');
    }
  }

  // PUT /api/v1/cases/:caseId/resume - Resume a suspended case
  async resumeCase(caseId: string, resumeCaseData: ResumeCaseDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/resume`, resumeCaseData);
      // Backend returns { success: true, case: Case, task: Task }
      // Extract the case object from the response
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'resume case');
    }
  }

  // PUT /api/v1/cases/:caseId/abandon - Abandon a case
  async abandonCase(caseId: string, abandonCaseData: AbandonCaseDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/abandon`, abandonCaseData);
      // Backend returns { success: true, case: Case, task: Task }
      // Extract the case object from the response
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'abandon case');
    }
  }

  // POST /api/v1/cases/:caseId - Complete a draft case
  async completeCase(caseId: string, updateCaseData: UpdateCaseDto): Promise<Case> {
    try {
      const response = await apiClient.post<Case>(`${this.baseUrl}/${caseId}`, updateCaseData);
      // Backend returns { success: true, case: Case, completedTask: Task, newTask: Task }
      // Extract the case object from the response
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'complete case');
    }
  }

  // PUT /api/v1/cases/:caseId/approve - Approve case closure
  async approveCaseClosure(caseId: string, approveCaseData: ApproveCaseClosureDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/approve`, approveCaseData);
      // Backend returns { message: string, case: { case_id, status, updated_at }, completed_task: { task_id, status } }
      // Extract the case object from the response
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'approve case closure');
    }
  }

  // PUT /api/v1/cases/:caseId/reject - Reject a case closure
  async rejectCase(caseId: string, rejectCaseData: RejectCaseDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/reject`, rejectCaseData);
      // Backend returns { message: string, case: { case_id, status, updated_at } }
      // Extract the case object from the response
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'reject case');
    }
  }

  // PUT /api/v1/cases/:caseId/return-for-review - Return case for review
  async returnCaseForReview(caseId: string, returnCaseData: ReturnCaseForReviewDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/return-for-review`, returnCaseData);
      
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'return case for review');
    }
  }

  // PUT /api/v1/cases/:caseId/approve-creation - Approve case creation
  async approveCaseCreation(caseId: string): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/approve-creation`, {});
      
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'approve case creation');
    }
  }

  // PUT /api/v1/cases/:caseId/reject-creation - Reject case creation
  async rejectCaseCreation(caseId: string, rejectCaseData: RejectCaseCreationDto): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(`${this.baseUrl}/${caseId}/reject-creation`, rejectCaseData);
    
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'reject case creation');
    }
  }

  private validateCaseResponse(data: unknown): Case {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid case data received');
    }

    // Handle different response structures
    // Direct case object
    if ('case_id' in data) {
      return data as Case;
    }
    
    // Nested case object (e.g., from abandon case response)
    if ('case' in data && typeof data.case === 'object' && data.case !== null && 'case_id' in data.case) {
      return data.case as Case;
    }

    throw new Error('Case ID is missing from response');
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
      const details = Array.isArray((apiError as any).errors) && (apiError as any).errors.length
        ? `: ${((apiError as any).errors as string[]).join(', ')}`
        : '';
      return new Error((apiError.message || `Failed to ${operation}`) + details);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const caseService = new CaseService();
