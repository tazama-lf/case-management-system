import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCaseDashboard } from '../useCaseDashboard';
import { caseService } from '@/features/cases/services/caseService';

const authMocks = {
  hasInvestigatorRole: vi.fn(),
  hasSupervisorRole: vi.fn(),
  hasCMSAdminRole: vi.fn(),
};

const toastMock = { error: vi.fn() };
const routeMock = {
  params: {} as Record<string, string>,
  navigate: vi.fn(),
};

const transformBackendCaseToUI = vi.fn((backendCase: any) => ({
  id: backendCase.case_id,
  type: backendCase.case_type,
  typeColor: 'bg-gray-50',
  status: backendCase.status,
  statusColor: 'bg-gray-100',
  typologyId: backendCase.typology_id || 'N/A',
  score: backendCase.alert?.confidence_per ?? 0,
  createdOn: '01/01/2024',
  pickedOn: '-',
  action: backendCase.status === 'STATUS_00_DRAFT' ? 'Complete' : 'View',
  priority: backendCase.priority ?? 'LOW',
  userRole: backendCase.user_role ?? 'owner',
  totalTasks: backendCase.total_tasks ?? 0,
}));

vi.mock('@/features/cases/services/caseService', () => ({
  caseService: {
    getUserAssignedCases: vi.fn(),
    getAllCases: vi.fn(),
    getCaseDetails: vi.fn(),
  },
}));

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => authMocks,
}));

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => toastMock,
}));

vi.mock('@/shared/utils/routeUtils', () => ({
  useDynamicRoute: () => routeMock,
}));

vi.mock('@/features/cases/hooks', () => ({
  useCaseActions: (refresh: () => Promise<void>) => ({
    refresh,
  }),
}));

vi.mock('@/features/cases/components/casesTable.utils', () => ({
  transformBackendCaseToUI: (backendCase: any) =>
    transformBackendCaseToUI(backendCase),
}));

vi.mock('@/shared/hooks/useDebounce', () => ({
  default: (value: any) => value,
}));

type BackendCase = {
  case_id: number;
  case_type: string;
  status: string;
  priority?: string;
  total_tasks?: number;
  user_role?: string;
  alert?: { alert_id?: string; confidence_per?: number } | null;
  created_at?: string;
  updated_at?: string;
};

const createBackendCase = (
  overrides: Partial<BackendCase> = {},
): BackendCase => ({
  case_id: 1,
  case_type: 'FRAUD',
  status: 'STATUS_20_IN_PROGRESS',
  priority: 'HIGH',
  total_tasks: 3,
  user_role: 'owner',
  alert: { alert_id: 'ALERT-1', confidence_per: 80 },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  ...overrides,
});

describe('useCaseDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.params = {};
    toastMock.error.mockReset();

    authMocks.hasInvestigatorRole.mockReturnValue(false);
    authMocks.hasSupervisorRole.mockReturnValue(false);
    authMocks.hasCMSAdminRole.mockReturnValue(false);

    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });
  });

  it('fetches cases and applies search filtering via backend', async () => {
    const backendCases = [
      createBackendCase({ case_id: 100 }),
      createBackendCase({ case_id: 200, case_type: 'AML' }),
    ];

    (caseService.getAllCases as unknown as vi.Mock)
      .mockResolvedValueOnce({
        cases: backendCases,
        pagination: { total: 2, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        cases: [backendCases[1]],
        pagination: { total: 1, totalPages: 1 },
      });

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(caseService.getAllCases).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'updated_at',
        sortOrder: 'desc',
      }),
    );

    expect(result.current.dashboardState.cases).toHaveLength(2);

    act(() => {
      result.current.filterActions.setSearch('200');
    });

    await waitFor(() =>
      expect(result.current.dashboardState.cases).toHaveLength(1),
    );

    expect(result.current.dashboardState.cases[0].id).toBe(200);
  });

  it('opens the view modal when a route param matches a case id', async () => {
    routeMock.params = { caseId: '777' };

    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValueOnce({
      cases: [createBackendCase({ case_id: 777 })],
      pagination: { total: 1, totalPages: 1 },
    });

    (caseService.getCaseDetails as unknown as vi.Mock).mockResolvedValueOnce({
      case_id: 777,
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      case_type: 'FRAUD',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      case_owner_user_id: 'user-1',
      alert: {
        alert_id: 123,
        message: 'Test alert',
        confidence_per: 85,
        transaction: {},
      },
    });

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    await waitFor(() => 
      expect(result.current.modalState.isViewOpen).toBe(true)
    );

    expect(result.current.modalState.selectedRow?.id).toBe(777);

    act(() => {
      const firstRow = result.current.dashboardState.cases[0];
      result.current.dashboardActions.handleView(firstRow);
    });

    expect(routeMock.navigate).toHaveBeenCalledWith('/cases/777');
  });

  it('surfaces an error state when the service call fails', async () => {
    (caseService.getAllCases as unknown as vi.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(result.current.dashboardState.errorState).toBe(
      'Failed to load cases. Please try again.',
    );
    expect(result.current.dashboardState.cases).toHaveLength(0);
  });

  it('sets caseTypeFilter to draft and fetches with STATUS_00_DRAFT', async () => {
    const backendCases = [
      createBackendCase({ case_id: 1, status: 'STATUS_00_DRAFT' }),
    ];
    (caseService.getAllCases as unknown as vi.Mock)
      .mockResolvedValueOnce({
        cases: [],
        pagination: { total: 0, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        cases: backendCases,
        pagination: { total: 1, totalPages: 1 },
      });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.filterActions.setCaseTypeFilter('draft');
    });

    await waitFor(() =>
      expect(caseService.getAllCases).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'STATUS_00_DRAFT' }),
      ),
    );
  });

  it('sets caseTypeFilter to closed and fetches with closedOnly', async () => {
    (caseService.getAllCases as unknown as vi.Mock)
      .mockResolvedValueOnce({
        cases: [],
        pagination: { total: 0, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        cases: [],
        pagination: { total: 0, totalPages: 1 },
      });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.filterActions.setCaseTypeFilter('closed');
    });

    await waitFor(() =>
      expect(caseService.getAllCases).toHaveBeenCalledWith(
        expect.objectContaining({ closedOnly: true }),
      ),
    );
  });

  it('default all caseTypeFilter excludes draft and closed', async () => {
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(caseService.getAllCases).toHaveBeenCalledWith(
      expect.objectContaining({ excludeDraft: true, excludeClosed: true }),
    );
  });

  it('handleComplete opens update alert modal when row.type is null', async () => {
    const backendCases = [createBackendCase({ case_id: 1 })];
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: backendCases,
      pagination: { total: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    const row = {
      ...result.current.dashboardState.cases[0],
      type: null,
    } as any;
    act(() => {
      result.current.dashboardActions.handleComplete(row);
    });
    expect(result.current.modalState.isUpdateAlertOpen).toBe(true);
  });

  it('handleComplete opens create modal in edit mode when row.type is set', async () => {
    const backendCases = [createBackendCase({ case_id: 1 })];
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: backendCases,
      pagination: { total: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    const row = result.current.dashboardState.cases[0];
    act(() => {
      result.current.dashboardActions.handleComplete(row);
    });
    expect(result.current.modalState.isCreateOpen).toBe(true);
    expect(result.current.modalState.createModalMode).toBe('edit');
  });

  it('opens close/reopen/abandon/suspend/resume modals', async () => {
    const backendCases = [createBackendCase({ case_id: 1 })];
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: backendCases,
      pagination: { total: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    const row = result.current.dashboardState.cases[0];

    act(() => {
      result.current.dashboardActions.handleCloseCase(row);
    });
    expect(result.current.modalState.isCloseCaseOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleReopenCase(row);
    });
    expect(result.current.modalState.isReopenOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleAbandonCase(row);
    });
    expect(result.current.modalState.isAbandonOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleSuspendCase(row);
    });
    expect(result.current.modalState.isSuspendOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleResumeCase(row);
    });
    expect(result.current.modalState.isResumeOpen).toBe(true);
  });

  it('opens reject/approve/creation/reopen modals', async () => {
    const backendCases = [createBackendCase({ case_id: 1 })];
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: backendCases,
      pagination: { total: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    const row = result.current.dashboardState.cases[0];

    act(() => {
      result.current.dashboardActions.handleRejectCase(row);
    });
    expect(result.current.modalState.isCaseClosureDecisionOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleApproveCase(row);
    });
    expect(result.current.modalState.isCaseClosureDecisionOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleApproveCaseCreation(row);
    });
    expect(result.current.modalState.isApproveCreationOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleRejectCaseCreation(row);
    });
    expect(result.current.modalState.isRejectCreationOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleApproveCaseReopen(row);
    });
    expect(result.current.modalState.isApproveReopenOpen).toBe(true);

    act(() => {
      result.current.dashboardActions.handleRejectCaseReopen(row);
    });
    expect(result.current.modalState.isRejectReopenOpen).toBe(true);
  });

  it('handleCreateNew opens create modal in create mode', async () => {
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.dashboardActions.handleCreateNew();
    });
    expect(result.current.modalState.isCreateOpen).toBe(true);
    expect(result.current.modalState.createModalMode).toBe('create');
  });

  it('setPageSize resets to page 1', async () => {
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.setPageSize(50);
    });
    expect(result.current.dashboardState.pagination.currentPage).toBe(1);
    expect(result.current.dashboardState.pagination.pageSize).toBe(50);
  });

  it('setCurrentPage updates page', async () => {
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 100, totalPages: 5 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.setCurrentPage(3);
    });
    expect(result.current.dashboardState.pagination.currentPage).toBe(3);
  });

  it('sets permissions for supervisor', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(
      result.current.dashboardState.permissions.canManageSupervisorActions,
    ).toBe(true);
    expect(result.current.dashboardState.permissions.isInvestigatorOnly).toBe(
      false,
    );
  });

  it('sets permissions for investigator only', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(result.current.dashboardState.permissions.isInvestigatorOnly).toBe(
      true,
    );
    expect(
      result.current.dashboardState.permissions.canManageSupervisorActions,
    ).toBe(false);
  });

  it('navigates away when route caseId does not match any case', async () => {
    routeMock.params = { caseId: '999' };
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [createBackendCase({ case_id: 1 })],
      pagination: { total: 1, totalPages: 1 },
    });
    (caseService.getCaseDetails as unknown as vi.Mock).mockRejectedValue(
      new Error('Case not found')
    );

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    await waitFor(() => 
      expect(routeMock.navigate).toHaveBeenCalledWith('/cases')
    );
    
    expect(toastMock.error).toHaveBeenCalledWith('Failed to load case details');
  });

  it('applies sortBy filter', async () => {
    (caseService.getAllCases as unknown as vi.Mock)
      .mockResolvedValueOnce({
        cases: [],
        pagination: { total: 0, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        cases: [],
        pagination: { total: 0, totalPages: 1 },
      });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.filterActions.setSortBy('oldest');
    });

    await waitFor(() =>
      expect(caseService.getAllCases).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 'asc' }),
      ),
    );
  });

  it('applies status and priority filters', async () => {
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
      pagination: { total: 0, totalPages: 1 },
    });

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    act(() => {
      result.current.filterActions.setStatusFilter('STATUS_20_IN_PROGRESS');
      result.current.filterActions.setPriorityFilter('HIGH');
      result.current.filterActions.setSarStrStatusFilter('completed');
    });

    await waitFor(() =>
      expect(caseService.getAllCases).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'STATUS_20_IN_PROGRESS',
          priority: 'HIGH',
          sarStrStatus: 'completed',
        }),
      ),
    );
  });
});
