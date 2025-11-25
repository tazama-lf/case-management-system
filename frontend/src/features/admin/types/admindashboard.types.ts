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


// export interface WorkQueueRole {
//   id: string;
//   name: string;
//   color: 'blue' | 'green' | 'purple' | 'orange';
// }

// export interface WorkQueueTaskType {
//   id: string;
//   name: string;
//   color: 'blue' | 'green' | 'purple' | 'red' | 'orange';
// }

// export interface User {
//   id: string;
//   firstName: string;
//   lastName: string;
//   email: string;
//   role: string;
//   department: string;
//   status: 'Active' | 'Inactive' | 'Suspended';
//   lastLogin?: string;
//   createdAt: string;
//   permissions: string[];
// }

// export interface UserRole {
//   id: string;
//   name: string;
//   description: string;
//   permissions: string[];
// }

// export interface Permission {
//   id: string;
//   name: string;
//   category: string;
//   description: string;
// }

// export interface AdminDashboardStats {
//   activeWorkQueues: number;
//   userAccounts: number;
//   systemRoles: number;
//   pendingApprovals: number;
// }

// export interface SystemStatus {
//   priority: 'operational' | 'non-operational' ;
//   count: number;
//   description: string;
// }

// export interface CaseSummary {
//   status: 'assigned' | 'pending' | 'closed';
//   count: number;
//   description: string;
// }

// export interface DashboardData {
//   stats: AdminDashboardStats;
//   recentAlerts: SystemStatus[];
//   activeCases: CaseSummary[];
// }