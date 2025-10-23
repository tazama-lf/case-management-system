import apiClient from '../../../shared/services/apiClient';
import type {
  ReportsData,
  InvestigatorWorkloadData,
  TaskCompletionData,
  AuditLogsData,
  CaseAgeingData
} from '../types/reports.types';

class ReportsService {
  async getReportsData(dateRange?: string, filters?: { caseType: string; priority: string; investigator: string }): Promise<ReportsData> {
    try {
      const params = new URLSearchParams();
      if (dateRange) params.append('dateRange', dateRange);
      if (filters?.caseType) params.append('caseType', filters.caseType);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.investigator) params.append('investigator', filters.investigator);

      const response = await apiClient.get<ReportsData>(`/api/v1/reports/case-status?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch reports data:', error);
      throw new Error('Failed to load reports data');
    }
  }



  async getInvestigatorWorkloadData(dateRange?: string): Promise<InvestigatorWorkloadData> {
    try {
      const response = await apiClient.get<InvestigatorWorkloadData>(`/api/v1/reports/investigator-workload?dateRange=${dateRange || 'last30'}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch investigator workload data:', error);
      throw new Error('Failed to load investigator workload data');
    }
  }


  async getTaskCompletionData(dateRange?: string): Promise<TaskCompletionData> {
    try {
      const response = await apiClient.get<TaskCompletionData>(`/api/v1/reports/task-completion?dateRange=${dateRange || 'last30'}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch task completion data:', error);
      throw new Error('Failed to load task completion data');
    }
  }

  async getAuditLogsData(dateRange?: string): Promise<AuditLogsData> {
    try {
      const response = await apiClient.get<AuditLogsData>(`/api/v1/reports/audit-logs?dateRange=${dateRange || 'last30'}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch audit logs data:', error);
      throw new Error('Failed to load audit logs data');
    }
  }


  async getCaseAgeingData(dateRange?: string): Promise<CaseAgeingData> {
    try {
      const response = await apiClient.get<CaseAgeingData>(`/api/v1/reports/case-ageing?dateRange=${dateRange || 'last30'}`);

      const processedResponse: CaseAgeingData = {
        ...response,
        stats: {
          avgCaseAge: this.safeFallback(response.stats?.avgCaseAge, 0),
          avgResolutionTime: this.safeFallback(response.stats?.avgResolutionTime, 0),
          casesOver15Days: this.safeFallback(response.stats?.casesOver15Days, 0),
          casesOver30Days: this.safeFallback(response.stats?.casesOver30Days, 0),
        },
        ageingByStatus: response.ageingByStatus || [],
        resolutionTrend: response.resolutionTrend || [],
        ageingDistribution: response.ageingDistribution || [],
        caseTypeResolution: response.caseTypeResolution || [],
        caseDetails: response.caseDetails || []
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch case ageing data:', error);

      return {
        stats: {
          avgCaseAge: 0,
          avgResolutionTime: 0,
          casesOver15Days: 0,
          casesOver30Days: 0,
        },
        ageingByStatus: [],
        resolutionTrend: [],
        ageingDistribution: [],
        caseTypeResolution: [],
        caseDetails: []
      };
    }
  }

  private safeFallback(value: number | null | undefined, fallback: number): number {
    if (value === null || value === undefined || isNaN(value)) {
      return fallback;
    }
    return value;
  }

}

export const reportsService = new ReportsService();
export default reportsService;
