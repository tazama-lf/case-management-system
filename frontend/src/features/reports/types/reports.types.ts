export interface CaseStatusStats {
  totalCases: number;
  closedCases: number;
  openCases: number;
  openAssignedCases: number;
  avgResolutionTime: number | null;
}

export interface CaseStatusDistribution {
  draft: number;
  pendingCaseCreationApproval: number;
  readyForAssignment: number;
  assigned: number;
  inProgress: number;
  suspended: number;
  pendingFinalApproval: number;
  pendingCaseReopeningApproval: number;
  autoclosedConfirmed: number;
  autoclosedRefuted: number;
  closedRefuted: number;
  closedConfirmed: number;
  closedInconclusive: number;
  abandoned: number;
}

export interface CaseType {
  name: string;
  count: number;
  color: string;
}

export interface CaseOutcome {
  resolved: number;
  refuted?: number;
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

export interface InvestigatorStats {
  totalInvestigators: number;
  avgCasesPerInvestigator: number;
  avgResolutionTime: number;
  caseClosureRate: number;
}

export interface InvestigatorWorkload {
  name: string;
  activeCases: number;
  pendingTasks: number;
  investigatorId: string;
}

export interface VolumeTrend {
  month: string;
  investigators: Record<string, number>;
}

export interface ResolutionEfficiency {
  name: string;
  avgDays: number;
}

export interface OutcomeDistribution {
  name: string;
  confirmed: number;
  refuted: number;
  inconclusive: number;
}

export interface InvestigatorPerformance {
  investigator: string;
  investigatorId: string;
  role: string;
  activeCases: number;
  completedCases: number;
  avgResolutionTime: number;
  caseClosureRate: number;
  performanceTrend: string;
}

export interface InvestigatorWorkloadData {
  stats: InvestigatorStats;
  workloadData: InvestigatorWorkload[];
  volumeTrend: VolumeTrend[];
  efficiencyData: ResolutionEfficiency[];
  outcomeData: OutcomeDistribution[];
  performanceData: InvestigatorPerformance[];
}

export interface TaskStats {
  totalTasks: number;
  completionRate: number;
  avgCompletionTime: number;
  overdueTasks: number;
}

export interface TaskCompletionByType {
  type: string;
  total: number;
  completed: number;
  pending: number;
}

export interface CompletionTime {
  type: string;
  avgDays: number;
}

export interface CompletionTrend {
  week: string;
  completionRate: number;
}

export interface TaskStatusDistribution {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TaskDetail {
  taskType: string;
  total: number;
  completed: number;
  completionRate: number;
  avgTime: number;
  trend: number;
}

export interface TaskCompletionData {
  stats: TaskStats;
  completionByType: TaskCompletionByType[];
  avgCompletionTime: CompletionTime[];
  completionTrend: CompletionTrend[];
  statusDistribution: TaskStatusDistribution[];
  taskDetails: TaskDetail[];
}

export interface AuditLogsStats {
  totalLogs: number;
  caseActions: number;
  userSessions: number;
  systemWarnings: number;
}

export interface AuditLog {
  audit_log_id: string;
  user_id: string;
  operation: string;
  entity_name: string;
  action_performed: string;
  outcome: string;
  performed_at: string;
  type: 'Info' | 'Success' | 'Warning' | 'Error';
}

export interface CaseAgeingStats {
  /** null when there are no open cases */
  avgCaseAge: number | null;
  /** null when no cases closed in the selected window */
  avgResolutionTime: number | null;
  /** open cases aged 16-30 days, non-overlapping with casesOver30Days */
  casesOver15Days: number;
  casesOver30Days: number;
}

export interface AgeingByStatus {
  status: string;
  age0to7: number;
  age8to15: number;
  age16to30: number;
  age30Plus: number;
}

export interface ResolutionTrend {
  /** calendar-month bucket, e.g. "2026-06" */
  month: string;
  /** count of cases closed in this bucket */
  n: number;
  /** median days-to-close; null when no cases closed that month (renders as a gap) */
  median: number | null;
  /** 25th percentile days-to-close; null when no cases closed that month */
  p25: number | null;
  /** 75th percentile days-to-close; null when no cases closed that month */
  p75: number | null;
}

export interface AgeingDistribution {
  ageRange: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CaseTypeResolution {
  caseType: string;
  avgDays: number;
}

export interface CaseAgeingDetail {
  caseId: number;
  type: string;
  status: string;
  /** ISO 8601; localised client-side for display */
  createdDate: string;
  ageDays: number;
  priority: string;
  /** raw id, surfaced only on hover/export - resolve the display name (and the 'Unassigned' fallback) client-side */
  investigatorId: string | null;
}

export interface CaseAgeingData {
  stats: CaseAgeingStats;
  ageingByStatus: AgeingByStatus[];
  resolutionTrend: ResolutionTrend[];
  ageingDistribution: AgeingDistribution[];
  caseTypeResolution: CaseTypeResolution[];
  caseDetails: CaseAgeingDetail[];
}

// Evidence Findings Report Types
export interface EvidenceFindingsStats {
  totalFindings: number;
  evidenceItems: number;
  confirmedFindings: number;
  refutedFindings: number;
  inProgressFindings: number;
  inconclusiveFindings: number;
}

export interface FindingStatusDistribution {
  confirmed: number;
  refuted: number;
  inconclusive: number;
  inProgress: number;
}

export interface EvidenceItem {
  id: string;
  type: string;
  count: number;
  percentage: number;
  status: 'Confirmed' | 'Refuted' | 'Inconclusive';
}

export interface SupportingEvidence {
  id: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  evidenceType?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt?: string;
  description?: string;
  hash?: string;
}

export interface TaskEvidence {
  taskId?: number;
  supportingEvidence: SupportingEvidence[];
}

export interface FindingDetail {
  caseId: number;
  finding: string;
  conclusion: 'Confirmed' | 'Refuted' | 'Inconclusive' | 'InProgress';
  evidenceCount: number;
  tasks: TaskEvidence[];
  dateIdentified: string;
}

export interface EvidenceFindingsData {
  stats: EvidenceFindingsStats;
  statusDistribution: FindingStatusDistribution;
  evidenceItems: EvidenceItem[];
  findings: FindingDetail[];
}
