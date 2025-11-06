export { default as Reports } from './pages/CaseStatusReport';
export { default as InvestigatorWorkloadReport } from './pages/InvestigatorWorkloadReport';
export { default as AuditLogsReport } from './pages/AuditLogsReport';
export { default as CaseAgeingReport } from './pages/CaseAgeingReport';

export { default as ReportStatsCards } from './components/ReportStatsCards';
export { default as ReportFilters } from './components/ReportFilters';
export { default as FiltersPanel } from './components/FiltersPanel';
export { default as PieChart } from './components/PieChart';
export { default as BarChart } from './components/BarChart';
export { default as LineChart } from './components/LineChart';
export { default as ReportsTable } from './components/ReportsTable';

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
