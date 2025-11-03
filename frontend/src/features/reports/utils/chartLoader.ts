import { lazy } from 'react';

export const PieChart = lazy(() => import('../components/PieChart'));
export const BarChart = lazy(() => import('../components/BarChart'));
export const LineChart = lazy(() => import('../components/LineChart'));
export const MultiBarChart = lazy(() => import('../components/MultiBarChart'));

export const CaseAgeingBarChart = lazy(() => import('../components/CaseAgeingBarChart'));
export const CaseAgeingPieChart = lazy(() => import('../components/CaseAgeingPieChart'));
export const CaseTypeResolutionChart = lazy(() => import('../components/CaseTypeResolutionChart'));
export const CaseVolumeTrendChart = lazy(() => import('../components/CaseVolumeTrendChart'));
export const CompletionRateTrendChart = lazy(() => import('../components/CompletionRateTrendChart'));
export const CompletionTimeChart = lazy(() => import('../components/CompletionTimeChart'));
export const OutcomeDistributionChart = lazy(() => import('../components/OutcomeDistributionChart'));
export const ResolutionEfficiencyChart = lazy(() => import('../components/ResolutionEfficiencyChart'));
export const ResolutionTimeTrendChart = lazy(() => import('../components/ResolutionTimeTrendChart'));
export const TaskCompletionBarChart = lazy(() => import('../components/TaskCompletionBarChart'));
export const TaskStatusPieChart = lazy(() => import('../components/TaskStatusPieChart'));
export const WorkloadBarChart = lazy(() => import('../components/WorkloadBarChart'));

export const AuditLogsTable = lazy(() => import('../components/AuditLogsTable'));
export const CaseAgeingTable = lazy(() => import('../components/CaseAgeingTable'));
export const TaskCompletionTable = lazy(() => import('../components/TaskCompletionTable'));
export const InvestigatorPerformanceTable = lazy(() => import('../components/InvestigatorPerformanceTable'));
export const ReportsTable = lazy(() => import('../components/ReportsTable'));