import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CaseDashboardContent from '../CaseDashboardContent';
import { vi, describe, it, expect } from 'vitest';
import type { CaseDashboardState } from '../../hooks/useCaseDashboard';

const mockHasComplianceOfficerRole = vi.fn().mockReturnValue(false);
vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
  }),
}));

// Mock child components to avoid complex setup
vi.mock('@/features/cases/components/CaseFilters', () => ({
  default: () => <div data-testid="case-filters">Case Filters</div>,
}));
// CasesTable is imported as { CasesTable } from '..' (cases feature barrel)
vi.mock('../..', () => ({
  CasesTable: () => <div data-testid="cases-table">Cases Table</div>,
}));
vi.mock('@/features/cases/components/CasesTableSkeleton', () => ({
  default: () => <div data-testid="cases-table-skeleton">Loading...</div>,
}));
vi.mock('@/shared/components/ui/ResultsSummary', () => ({
  default: () => <div data-testid="results-summary">Results Summary</div>,
}));
vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CaseDashboardContent', () => {
  const mockDashboardState: CaseDashboardState = {
    cases: [],
    loading: false,
    errorState: null,
    filters: {
      search: '',
      sortBy: 'recent',
      statusFilter: '',
      priorityFilter: '',
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
      isInvestigatorOnly: false,
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

  it('shows subtitle text', () => {
    render(
      <CaseDashboardContent
        dashboardState={mockDashboardState}
        {...mockHandlers}
      />,
    );

    expect(
      screen.getByText(/manage and track investigation cases/i),
    ).toBeInTheDocument();
  });

  it('hides create button for compliance officer role', () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);

    render(
      <CaseDashboardContent
        dashboardState={mockDashboardState}
        {...mockHandlers}
      />,
    );

    expect(screen.queryByText('Create Manually')).not.toBeInTheDocument();

    // Reset
    mockHasComplianceOfficerRole.mockReturnValue(false);
  });
});
