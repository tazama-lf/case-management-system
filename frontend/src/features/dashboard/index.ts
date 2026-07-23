export { default as Dashboard } from './pages/Dashboard';

export { default as StatsCard } from './components/StatsCard';
export { default as StatsCards } from './components/StatsCards';
export { default as DashboardSection } from './components/DashboardSection';
export { default as AlertSummaryItem } from './components/AlertSummaryItem';
export { default as CaseSummaryItem } from './components/CaseSummaryItem';

export { useDashboard } from './hooks/useDashboard';

export { dashboardService } from './services/dashboardService';

export type {
  DashboardStats,
  AlertSummary,
  CaseSummary,
  DashboardData,
} from './types/dashboard.types';
