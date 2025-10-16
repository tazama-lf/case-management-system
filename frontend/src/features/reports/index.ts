export { default as Reports } from './pages/Reports';

export { default as ReportStatsCards } from './components/ReportStatsCards';
export { default as ReportFilters } from './components/ReportFilters';
export { default as FiltersPanel } from './components/FiltersPanel';
export { default as PieChart } from './components/PieChart';
export { default as BarChart } from './components/BarChart';
export { default as LineChart } from './components/LineChart';
export { default as ReportsTable } from './components/ReportsTable';

export { useReports, useCaseStatusStats } from './hooks/useReports';

export { reportsService } from './services/reportsService';

export type {
  CaseStatusStats,
  CaseStatusDistribution,
  CaseType,
  CaseOutcome,
  MonthlyCaseTrend,
  CaseStatusDetail,
  ReportsData,
  ReportFilters as ReportFiltersType
} from './types/reports.types';
