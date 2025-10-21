import type { 
  ReportsData, 
  CaseStatusStats, 
  CaseStatusDistribution, 
  CaseType, 
  CaseOutcome, 
  MonthlyCaseTrend, 
  CaseStatusDetail,
  InvestigatorWorkloadData,
  TaskCompletionData,
  AuditLogsData,
  CaseAgeingData
} from '../types/reports.types';

class ReportsService {
  private getDateRange(dateRange?: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let endDate = new Date(now);
    let startDate = new Date(now);

    switch (dateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'last30':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last90':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        // Default to last 30 days
        startDate.setDate(now.getDate() - 30);
    }

    return { startDate, endDate };
  }
  async getReportsData(dateRange?: string): Promise<ReportsData> {
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

  // Investigator Workload Report Methods
  async getInvestigatorWorkloadData(dateRange?: string): Promise<InvestigatorWorkloadData> {
    try {
      const [stats, workloadData, volumeTrend, efficiencyData, outcomeData, performanceData] = await Promise.all([
        this.getInvestigatorStats(dateRange),
        this.getInvestigatorWorkload(),
        this.getVolumeTrend(),
        this.getResolutionEfficiency(),
        this.getOutcomeDistribution(),
        this.getInvestigatorPerformance()
      ]);

      return {
        stats,
        workloadData,
        volumeTrend,
        efficiencyData,
        outcomeData,
        performanceData
      };
    } catch (error) {
      console.error('Failed to fetch investigator workload data:', error);
      throw new Error('Failed to load investigator workload data');
    }
  }

  async getInvestigatorStats(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Adjust stats based on date range
    const multiplier = daysDiff / 30; // Normalize to 30-day period
    
    return {
      totalInvestigators: 5,
      avgCasesPerInvestigator: Math.round(8.4 * multiplier * 10) / 10,
      avgResolutionTime: Math.round(10.2 * multiplier * 10) / 10,
      caseClosureRate: Math.round(78.5 * multiplier * 10) / 10
    };
  }

  async getInvestigatorWorkload() {
    return [
      { name: 'John Doe', activeCases: 6, pendingTasks: 2 },
      { name: 'Jane Smith', activeCases: 8, pendingTasks: 3 },
      { name: 'Mike Johnson', activeCases: 12, pendingTasks: 4 },
      { name: 'Sarah Wilson', activeCases: 9, pendingTasks: 2 },
      { name: 'Robert Chen', activeCases: 7, pendingTasks: 1 }
    ];
  }

  async getVolumeTrend() {
    return [
      { month: 'Jan', investigators: { 'John Doe': 8, 'Jane Smith': 6, 'Mike Johnson': 10, 'Sarah Wilson': 7, 'Robert Chen': 5 } },
      { month: 'Feb', investigators: { 'John Doe': 10, 'Jane Smith': 8, 'Mike Johnson': 12, 'Sarah Wilson': 9, 'Robert Chen': 6 } },
      { month: 'Mar', investigators: { 'John Doe': 9, 'Jane Smith': 7, 'Mike Johnson': 11, 'Sarah Wilson': 8, 'Robert Chen': 7 } },
      { month: 'Apr', investigators: { 'John Doe': 11, 'Jane Smith': 9, 'Mike Johnson': 13, 'Sarah Wilson': 10, 'Robert Chen': 8 } },
      { month: 'May', investigators: { 'John Doe': 12, 'Jane Smith': 10, 'Mike Johnson': 14, 'Sarah Wilson': 11, 'Robert Chen': 9 } },
      { month: 'Jun', investigators: { 'John Doe': 10, 'Jane Smith': 8, 'Mike Johnson': 12, 'Sarah Wilson': 9, 'Robert Chen': 7 } }
    ];
  }

  async getResolutionEfficiency() {
    return [
      { name: 'John Doe', avgDays: 10 },
      { name: 'Jane Smith', avgDays: 8 },
      { name: 'Mike Johnson', avgDays: 8 },
      { name: 'Sarah Wilson', avgDays: 9 },
      { name: 'Robert Chen', avgDays: 11 }
    ];
  }

  async getOutcomeDistribution() {
    return [
      { name: 'John Doe', confirmed: 15, refuted: 20, inconclusive: 8 },
      { name: 'Jane Smith', confirmed: 18, refuted: 22, inconclusive: 6 },
      { name: 'Mike Johnson', confirmed: 12, refuted: 18, inconclusive: 10 },
      { name: 'Sarah Wilson', confirmed: 16, refuted: 19, inconclusive: 7 },
      { name: 'Robert Chen', confirmed: 10, refuted: 15, inconclusive: 9 }
    ];
  }

  async getInvestigatorPerformance() {
    return [
      { investigator: 'John Doe', role: 'Fraud Analyst', activeCases: 11, completedCases: 49, avgResolutionTime: 12.0, caseClosureRate: 73.1, performanceTrend: 'Declining' },
      { investigator: 'Jane Smith', role: 'AML Specialist', activeCases: 8, completedCases: 51, avgResolutionTime: 10.4, caseClosureRate: 80.0, performanceTrend: 'Declining' },
      { investigator: 'Mike Johnson', role: 'KYC Specialist', activeCases: 11, completedCases: 41, avgResolutionTime: 9.9, caseClosureRate: 83.6, performanceTrend: 'Declining' },
      { investigator: 'Sarah Wilson', role: 'Compliance Officer', activeCases: 14, completedCases: 52, avgResolutionTime: 12.6, caseClosureRate: 79.7, performanceTrend: 'Declining' },
      { investigator: 'Robert Chen', role: 'Fraud Investigator', activeCases: 10, completedCases: 28, avgResolutionTime: 11.6, caseClosureRate: 71.7, performanceTrend: 'Declining' }
    ];
  }

  // Task Completion Report Methods
  async getTaskCompletionData(dateRange?: string): Promise<TaskCompletionData> {
    try {
      const [stats, completionByType, avgCompletionTime, completionTrend, statusDistribution, taskDetails] = await Promise.all([
        this.getTaskStats(dateRange),
        this.getTaskCompletionByType(),
        this.getCompletionTime(),
        this.getCompletionTrend(),
        this.getTaskStatusDistribution(),
        this.getTaskDetails()
      ]);

      return {
        stats,
        completionByType,
        avgCompletionTime,
        completionTrend,
        statusDistribution,
        taskDetails
      };
    } catch (error) {
      console.error('Failed to fetch task completion data:', error);
      throw new Error('Failed to load task completion data');
    }
  }

  async getTaskStats(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Adjust stats based on date range
    const multiplier = daysDiff / 30; // Normalize to 30-day period
    
    return {
      totalTasks: Math.round(242 * multiplier),
      completionRate: Math.round(75.3 * multiplier * 10) / 10,
      avgCompletionTime: Math.round(2.8 * multiplier * 10) / 10,
      overdueTasks: Math.round(12 * multiplier)
    };
  }

  async getTaskCompletionByType() {
    return [
      { type: 'Investigation', total: 57, completed: 45, pending: 12 },
      { type: 'Review', total: 40, completed: 32, pending: 8 },
      { type: 'Approval', total: 43, completed: 28, pending: 15 },
      { type: 'Documentation', total: 30, completed: 20, pending: 10 },
      { type: 'Customer Contact', total: 23, completed: 18, pending: 5 }
    ];
  }

  async getCompletionTime() {
    return [
      { type: 'Investigation', avgDays: 5.2 },
      { type: 'Review', avgDays: 2.3 },
      { type: 'Approval', avgDays: 1.7 },
      { type: 'Documentation', avgDays: 3.1 },
      { type: 'Customer Contact', avgDays: 1.5 }
    ];
  }

  async getCompletionTrend() {
    return [
      { week: 'Week 1', completionRate: 60 },
      { week: 'Week 2', completionRate: 65 },
      { week: 'Week 3', completionRate: 70 },
      { week: 'Week 4', completionRate: 72 },
      { week: 'Week 5', completionRate: 75 },
      { week: 'Week 6', completionRate: 78 }
    ];
  }

  async getTaskStatusDistribution() {
    return [
      { status: 'Completed', count: 143, percentage: 59, color: '#10b981' },
      { status: 'In Progress', count: 46, percentage: 19, color: '#3b82f6' },
      { status: 'Unassigned', count: 24, percentage: 10, color: '#6b7280' },
      { status: 'Blocked', count: 17, percentage: 7, color: '#f59e0b' },
      { status: 'Overdue', count: 12, percentage: 5, color: '#ef4444' }
    ];
  }

  async getTaskDetails() {
    return [
      { taskType: 'Investigation', total: 57, completed: 45, completionRate: 78.9, avgTime: 5.2, trend: 10 },
      { taskType: 'Review', total: 40, completed: 32, completionRate: 80.0, avgTime: 2.3, trend: 11 },
      { taskType: 'Approval', total: 43, completed: 28, completionRate: 65.1, avgTime: 1.7, trend: -18 },
      { taskType: 'Documentation', total: 30, completed: 20, completionRate: 66.7, avgTime: 3.1, trend: -17 },
      { taskType: 'Customer Contact', total: 23, completed: 18, completionRate: 78.3, avgTime: 1.5, trend: 13 }
    ];
  }

  // Audit Logs Report Methods
  async getAuditLogsData(dateRange?: string): Promise<AuditLogsData> {
    try {
      const [stats, auditLogs] = await Promise.all([
        this.getAuditLogsStats(dateRange),
        this.getAuditLogs()
      ]);

      return {
        stats,
        auditLogs
      };
    } catch (error) {
      console.error('Failed to fetch audit logs data:', error);
      throw new Error('Failed to load audit logs data');
    }
  }

  async getAuditLogsStats(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Adjust stats based on date range
    const multiplier = daysDiff / 30; // Normalize to 30-day period
    
    return {
      totalLogs: Math.round(1248 * multiplier),
      caseActions: Math.round(542 * multiplier),
      userSessions: Math.round(312 * multiplier),
      systemWarnings: Math.round(18 * multiplier)
    };
  }

  async getAuditLogs() {
    return [
      { timestamp: '10/21/2025 10:29:45 AM', action: 'Permission changed', user: 'Mike Johnson (Fraud Investigator)', caseId: '-', details: 'System action', type: 'Info' as const },
      { timestamp: '10/21/2025 10:28:32 AM', action: 'User logged in', user: 'John Doe (Fraud Analyst)', caseId: '-', details: 'System action', type: 'Success' as const },
      { timestamp: '10/21/2025 10:27:15 AM', action: 'Report generated', user: 'Robert Chen (Compliance Officer)', caseId: '-', details: 'System action', type: 'Info' as const },
      { timestamp: '10/21/2025 10:26:48 AM', action: 'Task completed', user: 'Jane Smith (AML Specialist)', caseId: '#205', details: 'Action performed on Case #205', type: 'Success' as const },
      { timestamp: '10/21/2025 10:25:22 AM', action: 'Task assigned', user: 'Sarah Wilson (KYC Specialist)', caseId: '#201', details: 'Action performed on Case #201', type: 'Info' as const },
      { timestamp: '10/21/2025 10:24:56 AM', action: 'Case resumed', user: 'Mike Johnson (Fraud Investigator)', caseId: '#203', details: 'Action performed on Case #203', type: 'Info' as const },
      { timestamp: '10/21/2025 10:23:41 AM', action: 'Case created', user: 'John Doe (Fraud Analyst)', caseId: '#204', details: 'Action performed on Case #204', type: 'Success' as const },
      { timestamp: '10/21/2025 10:22:18 AM', action: 'Case closed', user: 'Robert Chen (Compliance Officer)', caseId: '#202', details: 'Action performed on Case #202', type: 'Success' as const },
      { timestamp: '10/21/2025 10:21:03 AM', action: 'Case updated', user: 'Jane Smith (AML Specialist)', caseId: '#200', details: 'Action performed on Case #200', type: 'Info' as const },
      { timestamp: '10/21/2025 10:20:45 AM', action: 'System warning', user: 'System', caseId: '-', details: 'System action', type: 'Warning' as const }
    ];
  }

  // Case Ageing Report Methods
  async getCaseAgeingData(dateRange?: string): Promise<CaseAgeingData> {
    try {
      const [stats, ageingByStatus, resolutionTrend, ageingDistribution, caseTypeResolution, caseDetails] = await Promise.all([
        this.getCaseAgeingStats(dateRange),
        this.getAgeingByStatus(),
        this.getResolutionTrend(),
        this.getAgeingDistribution(),
        this.getCaseTypeResolution(),
        this.getCaseAgeingDetails()
      ]);

      return {
        stats,
        ageingByStatus,
        resolutionTrend,
        ageingDistribution,
        caseTypeResolution,
        caseDetails
      };
    } catch (error) {
      console.error('Failed to fetch case ageing data:', error);
      throw new Error('Failed to load case ageing data');
    }
  }

  async getCaseAgeingStats(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Adjust stats based on date range
    const multiplier = daysDiff / 30; // Normalize to 30-day period
    
    return {
      avgCaseAge: Math.round(12.5 * multiplier * 10) / 10,
      avgResolutionTime: Math.round(10.8 * multiplier * 10) / 10,
      casesOver15Days: Math.round(10 * multiplier),
      casesOver30Days: Math.round(2 * multiplier)
    };
  }

  async getAgeingByStatus() {
    return [
      { status: 'DRAFT', age0to7: 8, age8to15: 3, age16to30: 1, age30Plus: 0 },
      { status: 'ASSIGNED', age0to7: 12, age8to15: 5, age16to30: 1, age30Plus: 0 },
      { status: 'IN PROGRESS', age0to7: 15, age8to15: 7, age16to30: 2, age30Plus: 0 },
      { status: 'PENDING APPROVAL', age0to7: 4, age8to15: 2, age16to30: 0, age30Plus: 0 }
    ];
  }

  async getResolutionTrend() {
    return [
      { month: 'Jan', avgDays: 12 },
      { month: 'Feb', avgDays: 11 },
      { month: 'Mar', avgDays: 13 },
      { month: 'Apr', avgDays: 10 },
      { month: 'May', avgDays: 9 },
      { month: 'Jun', avgDays: 11 }
    ];
  }

  async getAgeingDistribution() {
    return [
      { ageRange: '0-7 days', count: 37, percentage: 53, color: '#10b981' },
      { ageRange: '8-15 days', count: 22, percentage: 32, color: '#f59e0b' },
      { ageRange: '16-30 days', count: 8, percentage: 12, color: '#ef4444' },
      { ageRange: '30+ days', count: 2, percentage: 3, color: '#7c2d12' }
    ];
  }

  async getCaseTypeResolution() {
    return [
      { caseType: 'Fraud', avgDays: 14 },
      { caseType: 'AML', avgDays: 15 },
      { caseType: 'KYC', avgDays: 8 }
    ];
  }

  async getCaseAgeingDetails() {
    return [
      { caseId: '200', type: 'KYC', status: 'ASSIGNED', createdDate: '9/15/2025', ageDays: 36, priority: 'Low', investigator: 'Mike Johnson' },
      { caseId: '201', type: 'Fraud', status: 'PENDING APPROVAL', createdDate: '10/12/2025', ageDays: 9, priority: 'Low', investigator: 'Sarah Wilson' },
      { caseId: '202', type: 'AML', status: 'IN PROGRESS', createdDate: '10/10/2025', ageDays: 11, priority: 'Medium', investigator: 'John Doe' },
      { caseId: '203', type: 'KYC', status: 'DRAFT', createdDate: '10/14/2025', ageDays: 7, priority: 'Medium', investigator: 'Jane Smith' },
      { caseId: '204', type: 'Fraud', status: 'ASSIGNED', createdDate: '10/8/2025', ageDays: 13, priority: 'High', investigator: 'Robert Chen' }
    ];
  }
}

export const reportsService = new ReportsService();
export default reportsService;
