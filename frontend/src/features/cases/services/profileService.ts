import apiClient from '../../../shared/services/apiClient';

export interface GenerateProfileFilters {
  dateFrom?: string;
  dateTo?: string;
  channel?: string;
  type?: string;
}

export interface GenerateProfileRequest {
  tenantId: string;
  filters?: GenerateProfileFilters;
  notes?: string;
}

export interface DetectedAnomaly {
  date: string;
  type: string;
  amount: number;
  description: string;
  risk: 'High' | 'Medium' | 'Low';
}

export interface ProfileMetrics {
  totalVolume: number;
  totalValue: number;
  crossBorderCount: number;
  entityId: string;
  entityName: string;
  entityRole: 'Creditor' | 'Debitor';
  transactionCurrency: string;
  transactionType: string;
  entityType?: string;
}

export interface SummaryTable {
  totalVolume: number;
  totalValue: number;
  avgTicketSize: number;
  deviationPercent: string;
}

export interface TransactionProfile {
  caseId: string;
  filters?: Record<string, string | number>;
  metrics: ProfileMetrics;
  outliers?: Record<string, unknown>;
  summaryTable?: SummaryTable;
  notes?: string;
  visualization?: string;
  detectedAnomalies?: DetectedAnomaly[];
}

export interface GenerateProfileResponse extends TransactionProfile { }

export interface GetProfileResponse extends TransactionProfile { }

export class ProfileService {
  private readonly baseUrl = '/api/v1/lakehouse/';

  async generateProfile(
    request: GenerateProfileRequest,
  ): Promise<GenerateProfileResponse> {
    try {
      const user = localStorage.getItem('user');
      let { tenantId } = request;
      if (user) {
        try {
          const userData = JSON.parse(user);
          tenantId = userData.tenantId || request.tenantId;
        } catch { }
      }
      const response = await apiClient.post<GenerateProfileResponse>(
        `${this.baseUrl}/profile/generate`,
        { ...request, tenantId },
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'generate transaction profile');
    }
  }

  // async getProfile(caseId: number): Promise<GetProfileResponse> {
  //   try {
  //     const response = await apiClient.get<GetProfileResponse>(
  //       `${this.baseUrl}/${caseId}`,
  //     );
  //     return response;
  //   } catch (error: any) {
  //     throw this.handleError(error, 'get transaction profile');
  //   }
  // }

  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      return new Error(error.response.data.message ?? `Failed to ${operation}`);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const profileService = new ProfileService();
