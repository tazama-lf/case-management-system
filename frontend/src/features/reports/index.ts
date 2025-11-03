export { default as Reports } from './pages/CaseStatusReport';
export { default as InvestigatorWorkloadReport } from './pages/InvestigatorWorkloadReport';
export { default as TaskCompletionReport } from './pages/TaskCompletionReport';
export { default as AuditLogsReport } from './pages/AuditLogsReport';
export { default as CaseAgeingReport } from './pages/CaseAgeingReport';

export { default as ReportStatsCards } from './components/ReportStatsCards';
export { default as ReportFilters } from './components/ReportFilters';
export { default as FiltersPanel } from './components/FiltersPanel';

export {
  PieChart,
  BarChart,
  LineChart,
  MultiBarChart,
  CaseAgeingBarChart,
  CaseAgeingPieChart,
  CaseTypeResolutionChart,
  CaseVolumeTrendChart,
  CompletionRateTrendChart,
  CompletionTimeChart,
  OutcomeDistributionChart,
  ResolutionEfficiencyChart,
  ResolutionTimeTrendChart,
  TaskCompletionBarChart,
  TaskStatusPieChart,
  WorkloadBarChart,
  AuditLogsTable,
  CaseAgeingTable,
  TaskCompletionTable,
  InvestigatorPerformanceTable,
  ReportsTable
} from './utils/chartLoader';

export { ChartLoadingFallback, TableLoadingFallback, ChartContainer } from './components/ChartComponents';

export {
  useReports,
  useCaseStatusStats,
  useInvestigatorWorkload,
  useTaskCompletion,
  useAuditLogs,
  useCaseAgeing
} from './hooks/useReports';

export { reportsService } from './services/reportsService';

export type {
  CaseStatusStats,
  CaseStatusDistribution,
  CaseType,
  CaseOutcome,
  MonthlyCaseTrend,
  CaseStatusDetail,
  ReportsData,
  ReportFilters as ReportFiltersType,
  InvestigatorStats,
  InvestigatorWorkload,
  VolumeTrend,
  ResolutionEfficiency,
  OutcomeDistribution,
  InvestigatorPerformance,
  InvestigatorWorkloadData,
  TaskStats,
  TaskCompletionByType,
  CompletionTime,
  CompletionTrend,
  TaskStatusDistribution,
  TaskDetail,
  TaskCompletionData,
  AuditLogsStats,
  AuditLog,
  AuditLogsData,
  CaseAgeingStats,
  AgeingByStatus,
  ResolutionTrend,
  AgeingDistribution,
  CaseTypeResolution,
  CaseAgeingDetail,
  CaseAgeingData
} from './types/reports.types';
