export interface CaseStatusStats {
  totalCases: number;
  closedCases: number;
  openCases: number;
  avgResolutionTime: number;
}

export interface CaseStatusDistribution {
  assigned: number;
  inProgress: number;
  draft: number;
  suspended: number;
  pendingApproval: number;
  closed: number;
}

export interface CaseType {
  name: string;
  count: number;
  color: string;
}

export interface CaseOutcome {
  resolved: number;
  confirmed: number;
  inconclusive: number;
  pending: number;
}

export interface MonthlyCaseTrend {
  month: string;
  casesCreated: number;
  casesClosed: number;
}

export interface CaseStatusDetail {
  status: string;
  count: number;
  percentage: string;
  avgTimeInStatus: string;
  currentTrendPeriod: string;
}

export interface ReportsData {
  stats: CaseStatusStats;
  statusDistribution: CaseStatusDistribution;
  caseTypes: CaseType[];
  outcomes: CaseOutcome;
  monthlyTrend: MonthlyCaseTrend[];
  statusDetails: CaseStatusDetail[];
}

export interface ReportFilters {
  dateRange: string;
  caseType: string;
  status: string;
  assignee: string;
}
