import apiClient from '../../../shared/services/apiClient';

export interface GenerateProfileFilters {
  dateFrom?: string;
  dateTo?: string;
  channel?: string;
  type?: string;
  geography?: string;
  account?: string;
  role?: string;
  creditorId?: string;
  debtorId?: string;
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
  avgTicketSize: number;
  crossBorderCount: number;
}

export interface SummaryTable {
  totalVolume: number;
  totalValue: number;
  avgTicketSize: number;
  deviationPercent: string;
}

export interface TransactionProfile {
  tenantId: string;
  filters?: Record<string, any>;
  metrics: Record<string, any>;
  outliers?: Record<string, any>;
  summaryTable?: Record<string, any>;
  notes?: string;
  visualization?: string;
  detectedAnomalies?: DetectedAnomaly[];
  transactionTable?: Array<Record<string, any>>;
}

export interface GenerateProfileResponse extends TransactionProfile {}

export interface GetProfileResponse extends TransactionProfile {}

export class ProfileService {
  private baseUrl = '/api/v1/dwh';

  async generateProfile(request: GenerateProfileRequest): Promise<GenerateProfileResponse> {
    try {
      const response = await apiClient.post<GenerateProfileResponse>(
         `${this.baseUrl}/profile/generate`,
        request,
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'generate transaction profile');
    }
  }

  async getProfile(tenantId: string): Promise<GetProfileResponse> {
    try {
      const response = await apiClient.get<GetProfileResponse>(
        `${this.baseUrl}/profile/${tenantId}`,
      );
      return response;
    } catch (error: any) {
      throw this.handleError(error, 'get transaction profile');
    }
  }

  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      return new Error(error.response.data.message || `Failed to ${operation}`);
    }
    return new Error(`Failed to ${operation}: ${error.message}`);
  }
}

export const profileService = new ProfileService();
