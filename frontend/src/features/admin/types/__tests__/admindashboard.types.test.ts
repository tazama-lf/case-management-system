import { describe, it, expect } from 'vitest';
import type {
  AdminDashboardStats,
  SystemStatus,
  CaseSummary,
  DashboardData,
  WorkQueue,
  WorkQueueRole,
  WorkQueueTaskType,
  User,
  UserRole,
  Permission,
} from '../admindashboard.types';

describe('admindashboard.types', () => {
  it('AdminDashboardStats interface can be instantiated', () => {
    const stats: AdminDashboardStats = {
      activeWorkQueues: 5,
      userAccounts: 100,
      systemRoles: 10,
      pendingApprovals: 3,
    };

    expect(stats.activeWorkQueues).toBe(5);
    expect(stats.userAccounts).toBe(100);
    expect(stats.systemRoles).toBe(10);
    expect(stats.pendingApprovals).toBe(3);
  });

  it('SystemStatus interface can be instantiated', () => {
    const status: SystemStatus = {
      priority: 'operational',
      count: 10,
      description: 'System is operational',
    };

    expect(status.priority).toBe('operational');
    expect(status.count).toBe(10);
    expect(status.description).toBe('System is operational');
  });

  it('CaseSummary interface can be instantiated', () => {
    const summary: CaseSummary = {
      status: 'assigned',
      count: 25,
      description: 'Assigned cases',
    };

    expect(summary.status).toBe('assigned');
    expect(summary.count).toBe(25);
    expect(summary.description).toBe('Assigned cases');
  });

  it('DashboardData interface can be instantiated', () => {
    const data: DashboardData = {
      stats: {
        activeWorkQueues: 5,
        userAccounts: 100,
        systemRoles: 10,
        pendingApprovals: 3,
      },
      recentAlerts: [],
      activeCases: [],
    };

    expect(data.stats).toBeDefined();
    expect(data.recentAlerts).toEqual([]);
    expect(data.activeCases).toEqual([]);
  });

  it('WorkQueue interface can be instantiated', () => {
    const queue: WorkQueue = {
      id: 'queue-1',
      name: 'Test Queue',
      description: 'Test Description',
      roles: ['admin', 'user'],
      taskTypes: ['TASK_1', 'TASK_2'],
      status: 'Active',
      taskCount: 10,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
      tenantId: 'tenant-1',
      createdByUserId: 'user-1',
      caseStatuses: null,
      caseTypes: null,
    };

    expect(queue.id).toBe('queue-1');
    expect(queue.status).toBe('Active');
    expect(queue.roles).toEqual(['admin', 'user']);
  });

  it('WorkQueueRole interface can be instantiated', () => {
    const role: WorkQueueRole = {
      id: 'role-1',
      name: 'Admin Role',
      color: 'blue',
    };

    expect(role.id).toBe('role-1');
    expect(role.color).toBe('blue');
  });

  it('WorkQueueTaskType interface can be instantiated', () => {
    const taskType: WorkQueueTaskType = {
      id: 'task-1',
      name: 'Review Task',
      color: 'green',
    };

    expect(taskType.id).toBe('task-1');
    expect(taskType.color).toBe('green');
  });

  it('User interface can be instantiated', () => {
    const user: User = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'admin',
      department: 'IT',
      status: 'Active',
      lastLogin: '2024-01-01',
      createdAt: '2024-01-01',
      permissions: ['read', 'write'],
    };

    expect(user.id).toBe('user-1');
    expect(user.status).toBe('Active');
    expect(user.permissions).toEqual(['read', 'write']);
  });

  it('UserRole interface can be instantiated', () => {
    const role: UserRole = {
      id: 'role-1',
      name: 'Administrator',
      description: 'Full system access',
      permissions: ['read', 'write', 'delete'],
    };

    expect(role.id).toBe('role-1');
    expect(role.permissions).toHaveLength(3);
  });

  it('Permission interface can be instantiated', () => {
    const permission: Permission = {
      id: 'perm-1',
      name: 'Read Cases',
      category: 'Cases',
      description: 'Ability to read case information',
    };

    expect(permission.id).toBe('perm-1');
    expect(permission.category).toBe('Cases');
  });
});

