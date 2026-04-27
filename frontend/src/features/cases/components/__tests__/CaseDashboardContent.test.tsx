import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CaseDashboardContent from '../CaseDashboardContent';
import { vi, describe, it, expect } from 'vitest';
import type { CaseDashboardState } from '../hooks/useCaseDashboard';

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => false,
    user: { id: 1, username: 'test' },
    isAuthenticated: true,
  }),
}));

// Mock child components to avoid complex setup
vi.mock('@/features/cases/components/CaseFilters', () => ({
  default: () => <div data-testid="case-filters">Case Filters</div>,
}));
vi.mock('@/features/cases/components/CasesTable', () => ({
  default: () => <div data-testid="cases-table">Cases Table</div>,
}));
vi.mock('@/features/cases/components/CasesTableSkeleton', () => ({
  default: () => <div data-testid="cases-table-skeleton">Loading...</div>,
}));
vi.mock('@/shared/components/ui/ResultsSummary', () => ({
  default: () => <div data-testid="results-summary">Results Summary</div>,
}));

describe('CaseDashboardContent', () => {
  const mockDashboardState: CaseDashboardState = {
    cases: [],
    loading: false,
    errorState: null,
    filters: {
      search: '',
      sortBy: 'recent',
      statusFilter: 'all',
      priorityFilter: 'all',
      sarStrStatusFilter: '',
      caseTypeFilter: 'all',
    },
    pagination: {
      currentPage: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    },
    permissions: {
      canManageSupervisorActions: true,
    },
  };

  const mockHandlers = {
    onSearchChange: vi.fn(),
    onSortChange: vi.fn(),
    onStatusFilterChange: vi.fn(),
    onPriorityFilterChange: vi.fn(),
    onSarStrStatusFilterChange: vi.fn(),
    onCaseTypeFilterChange: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onCreateNew: vi.fn(),
    onView: vi.fn(),
    onComplete: vi.fn(),
    onCloseCase: vi.fn(),
    onReopenCase: vi.fn(),
    onAbandonCase: vi.fn(),
    onSuspendCase: vi.fn(),
    onResumeCase: vi.fn(),
    onApproveCase: vi.fn(),
    onApproveCaseCreation: vi.fn(),
    onRejectCaseCreation: vi.fn(),
    onApproveCaseReopen: vi.fn(),
    onRejectCaseReopen: vi.fn(),
  };

  it('renders dashboard content correctly', () => {
    render(
      <CaseDashboardContent
        dashboardState={mockDashboardState}
        {...mockHandlers}
      />,
    );

    expect(screen.getByText('Cases Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('case-filters')).toBeInTheDocument();
    expect(screen.getByTestId('cases-table')).toBeInTheDocument();
    expect(screen.getByTestId('results-summary')).toBeInTheDocument();
  });

  it('renders loading skeleton when loading is true', () => {
    render(
      <CaseDashboardContent
        dashboardState={{ ...mockDashboardState, loading: true }}
        {...mockHandlers}
      />,
    );

    expect(screen.getByTestId('cases-table-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('cases-table')).not.toBeInTheDocument();
  });

  it('renders error message when errorState is present', () => {
    render(
      <CaseDashboardContent
        dashboardState={{
          ...mockDashboardState,
          errorState: 'Failed to fetch',
        }}
        {...mockHandlers}
      />,
    );

    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('calls onCreateNew when create button is clicked', () => {
    render(
      <CaseDashboardContent
        dashboardState={mockDashboardState}
        {...mockHandlers}
      />,
    );

    fireEvent.click(screen.getByText('Create Manually'));
    expect(mockHandlers.onCreateNew).toHaveBeenCalled();
  });
});
