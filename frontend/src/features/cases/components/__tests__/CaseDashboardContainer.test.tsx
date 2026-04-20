import { render, screen } from '@testing-library/react';
import CaseDashboardContainer from '../CaseDashboardContainer';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { useCaseDashboard } from '../../hooks/useCaseDashboard';

vi.mock('../CaseModalsManager', () => ({
  __esModule: true,
  default: () => <div data-testid="case-modals-manager" />,
}));

vi.mock('../../hooks/useCaseDashboard', () => ({
  useCaseDashboard: vi.fn(),
}));

const mockCaseRow = {
  id: 1,
  type: 'FRAUD',
  typeColor: 'bg-red-100',
  status: 'STATUS_20_IN_PROGRESS',
  statusColor: 'bg-yellow-100',
  typologyId: 'TYP-1',
  score: 80,
  createdOn: '01/01/2024',
  pickedOn: '02/01/2024',
  action: 'View' as const,
  assignee: 'Analyst',
  priority: 'HIGH',
  userRole: 'owner' as const,
  totalTasks: 3,
  alertId: 1,
};

const buildMockReturn = () => ({
  dashboardState: {
    cases: [mockCaseRow],
    loading: false,
    errorState: null,
    filters: {
      search: '',
      sortBy: 'recent' as const,
      statusFilter: '',
      priorityFilter: '',
      sarStrStatusFilter: '',
      caseTypeFilter: 'all',
    },
    pagination: {
      currentPage: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    },
    permissions: {
      canManageSupervisorActions: true,
      isInvestigatorOnly: false,
    },
  },
  modalState: {
    isCreateOpen: false,
    isViewOpen: false,
    isCloseCaseOpen: false,
    isReopenOpen: false,
    isAbandonOpen: false,
    isSuspendOpen: false,
    isResumeOpen: false,
    isCaseClosureDecisionOpen: false,
    isApproveCreationOpen: false,
    isRejectCreationOpen: false,
    isApproveReopenOpen: false,
    isRejectReopenOpen: false,
    selectedRow: null,
    createModalMode: 'create' as const,
    editingCaseId: null,
    createCaseLoading: false,
    createCaseError: '',
  },
  dashboardActions: {
    handleCreateNew: vi.fn(),
    handleView: vi.fn(),
    handleComplete: vi.fn(),
    handleCloseCase: vi.fn(),
    handleReopenCase: vi.fn(),
    handleAbandonCase: vi.fn(),
    handleSuspendCase: vi.fn(),
    handleResumeCase: vi.fn(),
    handleApproveCase: vi.fn(),
    handleApproveCaseCreation: vi.fn(),
    handleRejectCaseCreation: vi.fn(),
    handleApproveCaseReopen: vi.fn(),
    handleRejectCaseReopen: vi.fn(),
  },
  filterActions: {
    setSearch: vi.fn(),
    setSortBy: vi.fn(),
    setStatusFilter: vi.fn(),
    setPriorityFilter: vi.fn(),
    setSarStrStatusFilter: vi.fn(),
    setCaseTypeFilter: vi.fn(),
  },
  modalActions: {
    setIsCreateOpen: vi.fn(),
    setIsViewOpen: vi.fn(),
    setIsCloseCaseOpen: vi.fn(),
    setIsReopenOpen: vi.fn(),
    setIsAbandonOpen: vi.fn(),
    setIsSuspendOpen: vi.fn(),
    setIsResumeOpen: vi.fn(),
    setIsCaseClosureDecisionOpen: vi.fn(),
    setIsApproveCreationOpen: vi.fn(),
    setIsRejectCreationOpen: vi.fn(),
    setIsApproveReopenOpen: vi.fn(),
    setIsRejectReopenOpen: vi.fn(),
    setSelectedRow: vi.fn(),
    setCreateModalMode: vi.fn(),
    setEditingCaseId: vi.fn(),
    setCreateCaseLoading: vi.fn(),
    setCreateCaseError: vi.fn(),
  },
  caseActions: {
    handleCloseCaseSubmit: vi.fn(),
    handleAbandonSubmit: vi.fn(),
    handleSuspendSubmit: vi.fn(),
    handleResumeSubmit: vi.fn(),
    handleApproveClosureSubmit: vi.fn(),
    handleApproveCreation: vi.fn(),
    handleRejectCaseCreation: vi.fn(),
    handleRejectCase: vi.fn(),
    handleReopenSubmit: vi.fn(),
  },
  setCurrentPage: vi.fn(),
  setPageSize: vi.fn(),
  refreshCases: vi.fn(),
});

describe('CaseDashboardContainer component', () => {
  beforeEach(() => {
    vi.mocked(useCaseDashboard).mockReturnValue(buildMockReturn());
  });

  it('renders the dashboard heading provided by the content component', () => {
    render(<CaseDashboardContainer />);
    expect(
      screen.getByRole('heading', { name: /cases dashboard/i }),
    ).toBeInTheDocument();
  });

  it('wires the create button to the dashboard actions', () => {
    const mockReturn = buildMockReturn();
    vi.mocked(useCaseDashboard).mockReturnValue(mockReturn);

    render(<CaseDashboardContainer />);
    screen.getByRole('button', { name: /create manually/i }).click();

    expect(mockReturn.dashboardActions.handleCreateNew).toHaveBeenCalled();
  });
});
