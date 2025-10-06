export interface DashboardStats {
  totalAlerts: number;
  highPriorityAlerts: number;
  openCases: number;
  casesResolvedThisWeek: number;
}

export interface AlertSummary {
  priority: 'high' | 'medium' | 'low';
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
  recentAlerts: AlertSummary[];
  activeCases: CaseSummary[];
}
