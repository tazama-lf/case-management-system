export interface DashboardStats {
  totalAlerts: number;
  highPriorityAlerts: number;
  openCases: number;
  casesResolvedThisWeek: number;
}

export interface AlertSummary {
  priority: 'High' | 'Medium' | 'Low';
  count: number;
  description: string;
}

export interface CaseSummary {
  status: 'assigned' | 'pending' | 'closed';
  count: number;
  description: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentCases: AlertSummary[];
  activeCases: CaseSummary[];
}
