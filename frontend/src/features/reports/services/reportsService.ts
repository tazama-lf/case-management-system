import type { 
  ReportsData, 
  CaseStatusStats, 
  CaseStatusDistribution, 
  CaseType, 
  CaseOutcome, 
  MonthlyCaseTrend, 
  CaseStatusDetail 
} from '../types/reports.types';

class ReportsService {
  async getReportsData(): Promise<ReportsData> {
    try {
      const [stats, statusDistribution, caseTypes, outcomes, monthlyTrend, statusDetails] = await Promise.all([
        this.getCaseStatusStats(),
        this.getStatusDistribution(),
        this.getCaseTypes(),
        this.getCaseOutcomes(),
        this.getMonthlyTrend(),
        this.getStatusDetails()
      ]);

      return {
        stats,
        statusDistribution,
        caseTypes,
        outcomes,
        monthlyTrend,
        statusDetails
      };
    } catch (error) {
      console.error('Failed to fetch reports data:', error);
      throw new Error('Failed to load reports data');
    }
  }

  async getCaseStatusStats(): Promise<CaseStatusStats> {
    return {
      totalCases: 100,
      closedCases: 32,
      openCases: 68,
      avgResolutionTime: 12.5
    };
  }

  async getStatusDistribution(): Promise<CaseStatusDistribution> {
    return {
      assigned: 18,
      inProgress: 24,
      draft: 12,
      suspended: 8,
      pendingApproval: 6,
      closed: 32
    };
  }

  async getCaseTypes(): Promise<CaseType[]> {
    return [
      { name: 'Fraud', count: 45, color: '#ef4444' },
      { name: 'AML', count: 35, color: '#8b5cf6' },
      { name: 'KYC', count: 20, color: '#3b82f6' }
    ];
  }

  async getCaseOutcomes(): Promise<CaseOutcome> {
    return {
      resolved: 35,
      confirmed: 28,
      inconclusive: 15,
      pending: 22
    };
  }

  async getMonthlyTrend(): Promise<MonthlyCaseTrend[]> {
    return [
      { month: 'Feb', casesCreated: 15, casesClosed: 12 },
      { month: 'Mar', casesCreated: 18, casesClosed: 16 },
      { month: 'Apr', casesCreated: 22, casesClosed: 19 },
      { month: 'May', casesCreated: 28, casesClosed: 25 },
      { month: 'Jun', casesCreated: 24, casesClosed: 22 },
      { month: 'Jul', casesCreated: 26, casesClosed: 24 }
    ];
  }

  async getStatusDetails(): Promise<CaseStatusDetail[]> {
    return [
      { status: 'DRAFT', count: 12, percentage: '12.0%', avgTimeInStatus: '5 days', currentTrendPeriod: '+1.5%' },
      { status: 'ASSIGNED', count: 18, percentage: '18.0%', avgTimeInStatus: '7 days', currentTrendPeriod: '+7%' },
      { status: 'IN PROGRESS', count: 24, percentage: '24.0%', avgTimeInStatus: '3 days', currentTrendPeriod: '+8%' },
      { status: 'CONFIRMED', count: 8, percentage: '8.0%', avgTimeInStatus: '2 days', currentTrendPeriod: '+2%' },
      { status: 'PENDING APPROVAL', count: 6, percentage: '6.0%', avgTimeInStatus: '6 days', currentTrendPeriod: '-1%' },
      { status: 'CLOSED', count: 32, percentage: '32.0%', avgTimeInStatus: '4 days', currentTrendPeriod: '+1%' }
    ];
  }
}

export const reportsService = new ReportsService();
export default reportsService;
