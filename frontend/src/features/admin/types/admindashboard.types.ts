export interface AdminDashboardStats {
  activeWorkQueues: number;
  userAccounts: number;
  systemRoles: number;
  pendingApprovals: number;
}

export interface SystemStatus {
  priority: 'operational' | 'non-operational';
  count: number;
  description: string;
}

export interface CaseSummary {
  status: 'assigned' | 'pending' | 'closed';
  count: number;
  description: string;
}

export interface DashboardData {
  stats: AdminDashboardStats;
  recentAlerts: SystemStatus[];
  activeCases: CaseSummary[];
}

export interface WorkQueue {
  id: string;
  name: string;
  type: string;
}

export interface CreateCandidateGroupRequest {
  groupId: string;
  groupName: string;
  groupType: string;
}

export interface CandidateGroupData {
  id: string;
  url: string;
  name: string;
  type: string;
}

export interface ReferenceIdsData {
  id: number;
  txTp: string;
  referenceIdName: string;
  createdAt: string;
}

export interface ReferenceIdsRequest {
  txTp: string;
  referenceIdName: string;
}