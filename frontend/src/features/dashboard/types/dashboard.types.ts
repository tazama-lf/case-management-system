export interface DashboardStats {
  totalAlerts: number;
  highPriorityAlerts: number;
  openCases: number;
  casesResolvedThisWeek: number;
  availableCases?: number;
  openAssignedCases?: number;
  resolvedThisMonth?: number;
  overdueCases?: number;
}

export interface AlertSummary {
  priority: 'High' | 'Medium' | 'Low';
  count: number;
  description: string;
}

export interface CaseSummary {
  status: string;
  count: number;
  description: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentCases: AlertSummary[];
  activeCases: CaseSummary[];
}
