// Admin Feature Exports
// Components
export { default as AuditLogsPanel } from './components/AuditLogsPanel';
export { default as StatsCards } from './components/StatsCards';
export { default as DashboardSection } from './components/DashboardSection';
export { default as WorkQueueManagement } from './components/WorkQueueManagement';
export { default as CreateWorkQueueModal } from './components/CreateWorkQueueModal';

// Hooks
export { useAuditLogs, useAuditLogEntry, useExportAuditLogs } from './hooks/useAuditLogs';
export { useSystemConfig, useUpdateSystemConfig, useSystemConfigAvailable } from './hooks/useSystemConfig';

export { auditLogService } from './services/auditLogService';
export { systemConfigService } from './services/systemConfigService';
// Pages
export { default as AdminDashboard } from './pages/AdminDashboard';

export type {
  AdminDashboardStats,
  SystemStatus,
  CaseSummary,
  DashboardData,
  WorkQueue,
  WorkQueueRole,
  WorkQueueTaskType,
  User,
  UserRole,
  Permission
} from './types/admindashboard.types';