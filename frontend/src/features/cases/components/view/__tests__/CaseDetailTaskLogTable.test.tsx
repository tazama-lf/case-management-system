import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CaseDetailTaskLogTable from '../CaseDetailTaskLogTable';

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d || 'N/A',
}));

vi.mock('@/shared/components/ui', () => ({
  EmptyState: ({ message }: any) => <div>{message || 'No data'}</div>,
}));

vi.mock('@/features/alerts/hooks/useAlertsQuery', () => ({
  useAlertOperations: () => ({}),
}));

vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'user-1', username: 'test' }),
  },
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => false,
    hasSupervisorRole: () => false,
    hasInvestigatorRole: () => true,
  }),
}));

vi.mock('@/features/cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    investigators: [],
    supervisors: [],
    complianceOfficers: [],
    fetchInvestigatorsList: vi.fn(),
    fetchSupervisorsList: vi.fn(),
    fetchComplianceOfficersList: vi.fn(),
  }),
}));

describe('CaseDetailTaskLogTable', () => {
  const mockTasks = [
    {
      task_id: 1,
      name: 'Investigate Alert',
      status: 'STATUS_10_OPEN',
      created_at: '2024-01-01',
      assignee: null,
      candidateGroup: 'investigators',
      case_id: 100,
    },
  ];

  it('renders task table with tasks', () => {
    render(
      <CaseDetailTaskLogTable
        tasks={mockTasks as any}
        onAssign={vi.fn()}
      />,
    );
    expect(screen.getByText('Task ID')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    render(
      <CaseDetailTaskLogTable
        tasks={[]}
        onAssign={vi.fn()}
      />,
    );
    // The table renders but with no rows
    expect(screen.getByText('Task ID')).toBeInTheDocument();
  });
});
