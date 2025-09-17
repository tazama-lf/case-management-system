import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';

// Supervisor-specific DTOs
export interface PendingApprovalCase {
  case_id: string;
  status: string;
  priority: string;
  case_type: string;
  created_at: Date;
  updated_at: Date;
  investigator_id: string;
  investigator_name?: string;
  recommended_outcome: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE';
  final_notes?: string;
  recommendations?: string;
  approval_task_id: string;
  alert?: {
    alert_id: string;
    message: string;
    confidence_per: number;
  };
}

export interface ApproveCaseClosureDto {
  approved: boolean;
  supervisor_notes?: string;
  final_outcome?: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE';
  rejection_reason?: string;
}

export interface SupervisorCasesResponseDto {
  cases: PendingApprovalCase[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalPendingApprovals: number;
    casesByOutcome: Record<string, number>;
    casesByPriority: Record<string, number>;
  };
}

// Interface for all cases (not just pending approvals)
export interface AllCasesResponseDto {
  cases: CaseForSupervisor[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalCases: number;
    casesByStatus: Record<string, number>;
    casesByPriority: Record<string, number>;
  };
}

// Extended case interface for supervisor view
export interface CaseForSupervisor {
  case_id: string;
  status: string;
  priority: string;
  case_type: string;
  created_at: Date;
  updated_at: Date;
  investigator_id?: string;
  investigator_name?: string;
  owner_id?: string;
  owner_name?: string;
  alert?: {
    alert_id: string;
    message: string;
    confidence_per: number;
  };
  // For cases pending approval
  recommended_outcome?: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE';
  final_notes?: string;
  recommendations?: string;
  approval_task_id?: string;
}

export class SupervisorService {
  private baseUrl = '/api/v1/supervisor';

  // GET /api/v1/supervisor/pending-approvals
  async getPendingApprovals(query?: {
    priority?: string;
    outcome?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<SupervisorCasesResponseDto> {
    try {
      const params = new URLSearchParams();
      
      if (query?.priority) params.append('priority', query.priority);
      if (query?.outcome) params.append('outcome', query.outcome);
      if (query?.page) params.append('page', String(query.page));
      if (query?.limit) params.append('limit', String(query.limit));
      if (query?.sortBy) params.append('sortBy', query.sortBy);
      if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

      const queryString = params.toString();
      const url = `${this.baseUrl}/pending-approvals${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<SupervisorCasesResponseDto>(url);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get pending approvals');
    }
  }

  // GET /api/v1/cases (fetch all cases for supervisor view - supervisors should see all cases)
  async getAllCases(query?: {
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<AllCasesResponseDto> {
    try {
      // First, try to get all cases from a supervisor endpoint (if it exists)
      // If not, we'll need to implement a different approach
      
      // For now, let's try multiple approaches to get all cases
      const approaches = [
        // Approach 1: Try supervisor-specific endpoint (if implemented)
        () => this.tryGetAllCasesFromSupervisorEndpoint(query),
        // Approach 2: Try getting cases without user restriction
        () => this.tryGetAllCasesFromCaseEndpoint(query),
        // Approach 3: Get user assigned cases (fallback)
        () => this.tryGetUserAssignedCases(query)
      ];

      for (const approach of approaches) {
        try {
          return await approach();
        } catch (error) {
          console.warn('Approach failed, trying next:', error);
          continue;
        }
      }

      throw new Error('All approaches to fetch cases failed');
    } catch (error: any) {
      throw this.handleError(error, 'get all cases');
    }
  }

  private async tryGetAllCasesFromSupervisorEndpoint(query?: any): Promise<AllCasesResponseDto> {
    // This would be the ideal endpoint: GET /api/v1/supervisor/cases
    const params = new URLSearchParams();
    
    if (query?.status) params.append('status', query.status);
    if (query?.priority) params.append('priority', query.priority);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const queryString = params.toString();
    const url = `${this.baseUrl}/cases${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<any>(url);
    return this.transformCasesResponse(response);
  }

  private async tryGetAllCasesFromCaseEndpoint(query?: any): Promise<AllCasesResponseDto> {
    // Try to get all cases from the general cases endpoint
    const params = new URLSearchParams();
    
    if (query?.status) params.append('status', query.status);
    if (query?.priority) params.append('priority', query.priority);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const queryString = params.toString();
    const url = `/api/v1/cases${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<any>(url);
    return this.transformCasesResponse(response);
  }

  private async tryGetUserAssignedCases(query?: any): Promise<AllCasesResponseDto> {
    // Fallback: get user assigned cases
    const params = new URLSearchParams();
    
    if (query?.status) params.append('status', query.status);
    if (query?.priority) params.append('priority', query.priority);
    if (query?.page) params.append('page', String(query.page));
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);
    
    // Include all cases (both owned and task assignments)
    params.append('includeTaskAssignments', 'true');
    params.append('includeOwnedCases', 'true');

    const queryString = params.toString();
    const url = `/api/v1/cases/user/assigned${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<any>(url);
    return this.transformCasesResponse(response);
  }

  private transformCasesResponse(response: any): AllCasesResponseDto {
    // Transform the response to match our supervisor interface
    const transformedCases: CaseForSupervisor[] = response.cases.map((caseData: any) => ({
      case_id: caseData.case_id,
      status: caseData.status,
      priority: caseData.priority,
      case_type: caseData.case_type,
      created_at: new Date(caseData.created_at),
      updated_at: new Date(caseData.updated_at),
      investigator_id: caseData.investigator_id,
      investigator_name: caseData.investigator_name,
      owner_id: caseData.owner_id,
      owner_name: caseData.owner_name,
      alert: caseData.alert ? {
        alert_id: caseData.alert.alert_id,
        message: caseData.alert.message,
        confidence_per: caseData.alert.confidence_per
      } : undefined,
      // These fields might be present for cases pending approval
      recommended_outcome: caseData.recommended_outcome,
      final_notes: caseData.final_notes,
      recommendations: caseData.recommendations,
      approval_task_id: caseData.approval_task_id
    }));

    return {
      cases: transformedCases,
      pagination: response.pagination,
      summary: {
        totalCases: response.pagination?.total || transformedCases.length,
        casesByStatus: response.summary?.casesByStatus || {},
        casesByPriority: response.summary?.casesByPriority || {}
      }
    };
  }

  // PUT /api/v1/supervisor/approve-case-closure/:taskId
  async approveCaseClosure(taskId: string, approvalData: ApproveCaseClosureDto): Promise<any> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/approve-case-closure/${taskId}`, approvalData);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'approve case closure');
    }
  }

  // GET /api/v1/supervisor/case-details/:caseId
  async getCaseDetails(caseId: string): Promise<any> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/case-details/${caseId}`);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get case details');
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

export const supervisorService = new SupervisorService();
