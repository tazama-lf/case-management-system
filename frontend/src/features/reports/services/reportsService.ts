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
      
     
      const processedResponse: ReportsData = {
        ...response,
        stats: {
          totalCases: this.safeFallback(response.stats?.totalCases, 0),
          closedCases: this.safeFallback(response.stats?.closedCases, 0),
          openCases: this.safeFallback(response.stats?.openCases, 0),
          avgResolutionTime: this.safeFallback(response.stats?.avgResolutionTime, 0),
        },
        statusDistribution: response.statusDistribution || {
          assigned: 0,
          inProgress: 0,
          draft: 0,
          suspended: 0,
          pendingApproval: 0,
          closed: 0
        },
        caseTypes: response.caseTypes || [],
        outcomes: response.outcomes || {
          resolved: 0,
          confirmed: 0,
          inconclusive: 0,
          pending: 0
        },
        monthlyTrend: response.monthlyTrend || [],
        statusDetails: response.statusDetails || []
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch reports data:', error);
      
  
      return {
        stats: {
          totalCases: 0,
          closedCases: 0,
          openCases: 0,
          avgResolutionTime: 0,
        },
        statusDistribution: {
          assigned: 0,
          inProgress: 0,
          draft: 0,
          suspended: 0,
          pendingApproval: 0,
          closed: 0
        },
        caseTypes: [],
        outcomes: {
          resolved: 0,
          confirmed: 0,
          inconclusive: 0,
          pending: 0
        },
        monthlyTrend: [],
        statusDetails: []
      };
    }
  }



  async getInvestigatorWorkloadData(dateRange?: string): Promise<InvestigatorWorkloadData> {
    try {
      const response = await apiClient.get<InvestigatorWorkloadData>(`/api/v1/reports/investigator-workload?dateRange=${dateRange || 'last30'}`);
      
    
      const processedResponse: InvestigatorWorkloadData = {
        ...response,
        stats: {
          totalInvestigators: this.safeFallback(response.stats?.totalInvestigators, 0),
          avgCasesPerInvestigator: this.safeFallback(response.stats?.avgCasesPerInvestigator, 0),
          avgResolutionTime: this.safeFallback(response.stats?.avgResolutionTime, 0),
          caseClosureRate: this.safeFallback(response.stats?.caseClosureRate, 0),
        },
        workloadData: response.workloadData || [],
        volumeTrend: response.volumeTrend || [],
        efficiencyData: response.efficiencyData || [],
        outcomeData: response.outcomeData || [],
        performanceData: response.performanceData || []
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch investigator workload data:', error);
   
      return {
        stats: {
          totalInvestigators: 0,
          avgCasesPerInvestigator: 0,
          avgResolutionTime: 0,
          caseClosureRate: 0,
        },
        workloadData: [],
        volumeTrend: [],
        efficiencyData: [],
        outcomeData: [],
        performanceData: []
      };
    }
  }


  async getTaskCompletionData(dateRange?: string): Promise<TaskCompletionData> {
    try {
      const response = await apiClient.get<TaskCompletionData>(`/api/v1/reports/task-completion?dateRange=${dateRange || 'last30'}`);
      

      const processedResponse: TaskCompletionData = {
        ...response,
        stats: {
          totalTasks: this.safeFallback(response.stats?.totalTasks, 0),
          completionRate: this.safeFallback(response.stats?.completionRate, 0),
          avgCompletionTime: this.safeFallback(response.stats?.avgCompletionTime, 0),
          overdueTasks: this.safeFallback(response.stats?.overdueTasks, 0),
        },
        completionByType: response.completionByType || [],
        avgCompletionTime: response.avgCompletionTime || [],
        completionTrend: response.completionTrend || [],
        statusDistribution: response.statusDistribution || [],
        taskDetails: response.taskDetails || []
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch task completion data:', error);
      
    
      return {
        stats: {
          totalTasks: 0,
          completionRate: 0,
          avgCompletionTime: 0,
          overdueTasks: 0,
        },
        completionByType: [],
        avgCompletionTime: [],
        completionTrend: [],
        statusDistribution: [],
        taskDetails: []
      };
    }
  }

  async getAuditLogsData(dateRange?: string): Promise<AuditLogsData> {
    try {
      const response = await apiClient.get<AuditLogsData>(`/api/v1/reports/audit-logs?dateRange=${dateRange || 'last30'}`);
      
   
      const processedResponse: AuditLogsData = {
        ...response,
        stats: {
          totalLogs: this.safeFallback(response.stats?.totalLogs, 0),
          caseActions: this.safeFallback(response.stats?.caseActions, 0),
          userSessions: this.safeFallback(response.stats?.userSessions, 0),
          systemWarnings: this.safeFallback(response.stats?.systemWarnings, 0),
        },
        auditLogs: response.auditLogs || []
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch audit logs data:', error);
          return {
        stats: {
          totalLogs: 0,
          caseActions: 0,
          userSessions: 0,
          systemWarnings: 0,
        },
        auditLogs: []
      };
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
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return fallback;
    }
    return value;
  }


  public formatDisplayValue(value: number | null | undefined, unit?: string): string {
    const safeValue = this.safeFallback(value, 0);
    if (unit) {
      return `${safeValue}${unit}`;
    }
    return safeValue.toString();
  }

}

export const reportsService = new ReportsService();
export default reportsService;