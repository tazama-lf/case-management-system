import apiClient from '../../../shared/services/apiClient';
import type { Case, ApiErrorResponse } from '../../alerts/types/triage.types';

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
  transaction?: unknown;
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

export interface CloseCaseDto {
  recommendedOutcome:
    | 'STATUS_81_CLOSED_REFUTED'
    | 'STATUS_82_CLOSED_CONFIRMED'
    | 'STATUS_83_CLOSED_INCONCLUSIVE';
  finalNotes?: string;
  recommendations?: string;
}

export interface ManualCreateCaseDto {
  alertId?: string;
  priorityScore?: number;
  alertType: string;
}

export interface UpdateCaseDto {
  status?: string;
  priority?: string;
  caseType?: string;
  caseOwnerUserId?: string;
}

export interface AbandonCaseDto {
  reason: string;
}

export interface ResumeCaseDto {
  reason: string;
}

export interface RejectCaseDto {
  rejectionReason: string;
}

export interface ReopenCaseDto {
  reason: string;
}

export interface SuspendCaseDto {
  reason: string;
}

export interface ApproveCaseClosureDto {
  finalOutcome:
    | 'STATUS_81_CLOSED_REFUTED'
    | 'STATUS_82_CLOSED_CONFIRMED'
    | 'STATUS_83_CLOSED_INCONCLUSIVE';
  supervisorComments?: string;
}

export interface ReturnCaseForReviewDto {
  reviewComments: string;
}

export interface RejectCaseCreationDto {
  reason: string;
}

export interface ApproveReopenResponseDto {
  success: boolean;
  message: string;
  case: Case;
  completed_approval_task?: { task_id: string; status: string };
  investigation_task?: {
    task_id: string;
    name: string;
    status: string;
    assigned_to?: string;
    candidateGroup?: string;
  };
}

export interface RejectReopenResponseDto {
  success: boolean;
  message: string;
  case: Case;
  completed_task?: { task_id: string; status: string };
  rejection_reason: string;
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

  async getUserCases(
    query?: GetUserCasesQueryDto,
  ): Promise<GetUserCasesResponseDto> {
    try {
      const params = new URLSearchParams();

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

  async getUserWorkloadStats(): Promise<UserWorkloadStatsDto> {
    try {
      const response = await apiClient.get<UserWorkloadStatsDto>(
        `${this.baseUrl}/user/workload`,
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get user workload stats');
    }
  }

  async getCaseDetails(caseId: string): Promise<Case> {
    try {
      const response = await apiClient.get<Case>(`${this.baseUrl}/${caseId}`);
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'get case details');
    }
  }

  async closeCase(
    caseId: string,
    closeCaseData: CloseCaseDto,
  ): Promise<CloseCaseResponseDto> {
    try {
      const response = await apiClient.put<CloseCaseResponseDto>(
        `${this.baseUrl}/${caseId}/close`,
        closeCaseData,
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'close case');
    }
  }

  async createCase(manualCreateCaseData: ManualCreateCaseDto): Promise<Case> {
    try {
      const response = await apiClient.post<Case>(
        `${this.baseUrl}/manual`,
        manualCreateCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'create case');
    }
  }

  async updateCase(
    caseId: string,
    updateCaseData: UpdateCaseDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.post<Case>(
        `${this.baseUrl}/${caseId}`,
        updateCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'update case');
    }
  }

  async abandonCase(
    caseId: string,
    abandonCaseData: AbandonCaseDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/abandon`,
        abandonCaseData,
      );
      if (response && typeof response === 'object' && 'case' in response) {
        return this.validateCaseResponse(response.case);
      }
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'abandon case');
    }
  }

  async resumeCase(
    caseId: string,
    resumeCaseData: ResumeCaseDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/resume`,
        resumeCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'resume case');
    }
  }

  async rejectCase(
    caseId: string,
    rejectCaseData: RejectCaseDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/reject`,
        rejectCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'reject case');
    }
  }

  async reopenCase(
    caseId: string,
    reopenCaseData: ReopenCaseDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/reopen`,
        reopenCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'reopen case');
    }
  }

  async approveCaseReopening(
    caseId: string,
  ): Promise<ApproveReopenResponseDto> {
    try {
      const response = await apiClient.put<ApproveReopenResponseDto>(
        `${this.baseUrl}/${caseId}/approve-reopening`,
        {},
      );
      if (response && (response as any).case) {
        return response as ApproveReopenResponseDto;
      }
      return {
        success: true,
        message: 'Case reopening approved',
        case: this.validateCaseResponse(response as unknown as Case),
      } as ApproveReopenResponseDto;
    } catch (error: any) {
      throw this.handleError(error, 'approve case reopening');
    }
  }

  async rejectCaseReopening(
    caseId: string,
    rejectionReason: string,
  ): Promise<RejectReopenResponseDto> {
    try {
      const response = await apiClient.put<RejectReopenResponseDto>(
        `${this.baseUrl}/${caseId}/reject-reopening`,
        { rejectionReason },
      );
      if (response && (response as any).case) {
        return response as RejectReopenResponseDto;
      }
      return {
        success: true,
        message: 'Case reopening rejected',
        case: this.validateCaseResponse(response as unknown as Case),
        rejection_reason: rejectionReason,
      } as RejectReopenResponseDto;
    } catch (error: any) {
      throw this.handleError(error, 'reject case reopening');
    }
  }

  async suspendCase(
    caseId: string,
    suspendCaseData: SuspendCaseDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/suspend`,
        suspendCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'suspend case');
    }
  }

  async approveCaseClosure(
    caseId: string,
    approveCaseData: ApproveCaseClosureDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/approve`,
        approveCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'approve case closure');
    }
  }

  async returnCaseForReview(
    caseId: string,
    returnCaseData: ReturnCaseForReviewDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/return-for-review`,
        returnCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'return case for review');
    }
  }

  async approveCaseCreation(caseId: string): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/approve-creation`,
        {},
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'approve case creation');
    }
  }

  async rejectCaseCreation(
    caseId: string,
    rejectCaseData: RejectCaseCreationDto,
  ): Promise<Case> {
    try {
      const response = await apiClient.put<Case>(
        `${this.baseUrl}/${caseId}/reject-creation`,
        rejectCaseData,
      );
      return this.validateCaseResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'reject case creation');
    }
  }

  private validateCaseResponse(data: unknown): Case {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid case data received');
    }

    if ('case_id' in data) {
      return data as Case;
    }

    if (
      'case' in data &&
      typeof data.case === 'object' &&
      data.case !== null &&
      'case_id' in data.case
    ) {
      return data.case as Case;
    }

    throw new Error('Case ID is missing from response');
  }

  async getUserAssignedCases(
    query?: GetUserCasesQueryDto,
  ): Promise<{ cases: CaseWithTasksDto[]; pagination?: any }> {
    try {
      const params = new URLSearchParams();

      if (query?.status) params.append('status', query.status);
      if (query?.priority) params.append('priority', query.priority);
      if (query?.includeTaskAssignments)
        params.append(
          'includeTaskAssignments',
          String(query.includeTaskAssignments),
        );
      if (query?.includeOwnedCases)
        params.append('includeOwnedCases', String(query.includeOwnedCases));
      if (query?.page) params.append('page', String(query.page));
      if (query?.limit) params.append('limit', String(query.limit));
      if (query?.sortBy) params.append('sortBy', query.sortBy);
      if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

      const queryString = params.toString();
      const url = `${this.baseUrl}/user/assigned${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<{
        cases: CaseWithTasksDto[];
        pagination?: any;
      }>(url);
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get user assigned cases');
    }
  }

  async getAllCases(
    query?: GetUserCasesQueryDto,
  ): Promise<{ cases: CaseWithTasksDto[]; pagination?: any }> {
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

      const response = await apiClient.get<{
        cases: CaseWithTasksDto[];
        pagination?: any;
      }>(url);
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
