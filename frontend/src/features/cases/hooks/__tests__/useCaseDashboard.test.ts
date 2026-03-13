import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useCaseDashboard from '../useCaseDashboard';
import { caseService } from '@/features/cases/services/caseService';

const authMocks = {
  hasInvestigatorRole: vi.fn(() => false),
  hasSupervisorRole: vi.fn(() => false),
  hasCMSAdminRole: vi.fn(() => false),
};

const toastMock = { error: vi.fn() };
const routeMock = {
  params: {} as Record<string, string>,
  navigate: vi.fn(),
};

vi.mock('@/features/cases/services/caseService', () => ({
  caseService: {
    getUserAssignedCases: vi.fn(),
    getAllCases: vi.fn(),
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
  useCaseActions: (refresh: () => Promise<void>) => ({ refresh }),
}));

vi.mock('@/features/cases/components/casesTable.utils', () => ({
  transformBackendCaseToUI: (c: any) => ({
    id: c.case_id,
    type: c.case_type,
    status: c.status,
    priority: c.priority ?? 'LOW',
    action: c.status === 'STATUS_00_DRAFT' ? 'Complete' : 'View',
  }),
}));

vi.mock('@/shared/hooks/useDebounce', () => ({
  default: (value: any) => value, // instant debounce for tests
}));

const createBackendCase = (overrides: any = {}) => ({
  case_id: 1,
  case_type: 'FRAUD',
  status: 'STATUS_20_IN_PROGRESS',
  priority: 'HIGH',
  ...overrides,
});

const defaultPagination = { total: 0, totalPages: 1, page: 1, limit: 20 };

describe('useCaseDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.params = {};
    authMocks.hasInvestigatorRole.mockReturnValue(false);
    authMocks.hasSupervisorRole.mockReturnValue(false);
    authMocks.hasCMSAdminRole.mockReturnValue(false);

    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);
    vi.mocked(caseService.getUserAssignedCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);
  });

  // ─── Initial load ─────────────────────────────────────────────

  it('fetches cases on mount and returns dashboard state', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);
    const cases = [createBackendCase({ case_id: 1 }), createBackendCase({ case_id: 2 })];
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases,
      pagination: { total: 2, totalPages: 1, page: 1, limit: 20 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));
    expect(result.current.dashboardState.cases).toHaveLength(2);
    expect(result.current.dashboardState.pagination.totalItems).toBe(2);
  });

  it('returns correct permissions for supervisor', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    expect(result.current.dashboardState.permissions.canManageSupervisorActions).toBe(true);
    expect(result.current.dashboardState.permissions.isInvestigatorOnly).toBe(false);
  });

  it('returns correct permissions for investigator only', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    expect(result.current.dashboardState.permissions.isInvestigatorOnly).toBe(true);
    expect(result.current.dashboardState.permissions.canManageSupervisorActions).toBe(false);
  });

  it('returns correct permissions for admin', async () => {
    authMocks.hasCMSAdminRole.mockReturnValue(true);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    expect(result.current.dashboardState.permissions.canManageSupervisorActions).toBe(true);
  });

  // ─── Error state ──────────────────────────────────────────────

  it('sets error state when fetch fails', async () => {
    vi.mocked(caseService.getAllCases).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    expect(result.current.dashboardState.errorState).toBe('Failed to load cases. Please try again.');
    expect(result.current.dashboardState.cases).toHaveLength(0);
  });

  // ─── Route param opens view modal ─────────────────────────────

  it('opens view modal when route param matches a case id', async () => {
    routeMock.params = { caseId: '1' };
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase({ case_id: 1 })],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.modalState.isViewOpen).toBe(true);
      expect(result.current.modalState.selectedRow?.id).toBe(1);
    });
  });

  it('navigates away when route param does not match any case', async () => {
    routeMock.params = { caseId: '999' };
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase({ case_id: 1 })],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    await waitFor(() => expect(routeMock.navigate).toHaveBeenCalledWith('/cases'));
  });

  // ─── Dashboard actions ────────────────────────────────────────

  it('handleView sets selectedRow and navigates', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase({ case_id: 1 })],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    const row = result.current.dashboardState.cases[0];
    act(() => result.current.dashboardActions.handleView(row));
    expect(result.current.modalState.isViewOpen).toBe(true);
    expect(routeMock.navigate).toHaveBeenCalledWith('/cases/1');
  });

  it('handleComplete opens create modal in edit mode', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase({ case_id: 1 })],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleComplete(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isCreateOpen).toBe(true);
    expect(result.current.modalState.createModalMode).toBe('edit');
    expect(result.current.modalState.editingCaseId).toBe(1);
  });

  it('handleCloseCase opens close modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleCloseCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isCloseCaseOpen).toBe(true);
  });

  it('handleReopenCase opens reopen modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleReopenCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isReopenOpen).toBe(true);
  });

  it('handleAbandonCase opens abandon modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleAbandonCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isAbandonOpen).toBe(true);
  });

  it('handleSuspendCase opens suspend modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleSuspendCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isSuspendOpen).toBe(true);
  });

  it('handleResumeCase opens resume modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleResumeCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isResumeOpen).toBe(true);
  });

  it('handleRejectCase opens closure decision modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleRejectCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isCaseClosureDecisionOpen).toBe(true);
  });

  it('handleApproveCase opens closure decision modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleApproveCase(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isCaseClosureDecisionOpen).toBe(true);
  });

  it('handleApproveCaseCreation opens approve creation modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleApproveCaseCreation(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isApproveCreationOpen).toBe(true);
  });

  it('handleRejectCaseCreation opens reject creation modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleRejectCaseCreation(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isRejectCreationOpen).toBe(true);
  });

  it('handleApproveCaseReopen opens approve reopen modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleApproveCaseReopen(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isApproveReopenOpen).toBe(true);
  });

  it('handleRejectCaseReopen opens reject reopen modal', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleRejectCaseReopen(result.current.dashboardState.cases[0]));
    expect(result.current.modalState.isRejectReopenOpen).toBe(true);
  });

  it('handleCreateNew opens create modal in create mode', async () => {
    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.dashboardActions.handleCreateNew());
    expect(result.current.modalState.isCreateOpen).toBe(true);
    expect(result.current.modalState.createModalMode).toBe('create');
    expect(result.current.modalState.editingCaseId).toBeNull();
  });

  // ─── Filter & Pagination ─────────────────────────────────────

  it('setPageSize resets to page 1', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.setPageSize(50));
    expect(result.current.dashboardState.pagination.pageSize).toBe(50);
    expect(result.current.dashboardState.pagination.currentPage).toBe(1);
  });

  it('refreshCases triggers a fetch', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    const callCount = vi.mocked(caseService.getAllCases).mock.calls.length;
    await act(async () => { await result.current.refreshCases(); });
    expect(vi.mocked(caseService.getAllCases).mock.calls.length).toBeGreaterThan(callCount);
  });

  // ─── Modal actions ────────────────────────────────────────────

  it('exposes all modal setters', async () => {
    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    expect(typeof result.current.modalActions.setIsCreateOpen).toBe('function');
    expect(typeof result.current.modalActions.setIsViewOpen).toBe('function');
    expect(typeof result.current.modalActions.setSelectedRow).toBe('function');
    expect(typeof result.current.modalActions.setIsCloseCaseOpen).toBe('function');
    expect(typeof result.current.modalActions.setIsReopenOpen).toBe('function');
    expect(typeof result.current.modalActions.setIsAbandonOpen).toBe('function');
    expect(typeof result.current.modalActions.setIsSuspendOpen).toBe('function');
    expect(typeof result.current.modalActions.setIsResumeOpen).toBe('function');
  });

  // ─── setCurrentPage ───────────────────────────────────────────

  it('setCurrentPage updates the current page', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: { ...defaultPagination, total: 100, totalPages: 5 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    act(() => result.current.setCurrentPage(3));
    expect(result.current.dashboardState.pagination.currentPage).toBe(3);
  });

  // ─── Filter: draft type ───────────────────────────────────────

  it('uses draft filter when caseTypeFilter is draft', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    await act(async () => {
      result.current.filterActions.setCaseTypeFilter('draft');
    });

    await waitFor(() => {
      const lastCall = vi.mocked(caseService.getAllCases).mock.calls.at(-1)?.[0] as any;
      expect(lastCall?.status).toBe('STATUS_00_DRAFT');
    });
  });

  // ─── Filter: closed type ──────────────────────────────────────

  it('uses closed filter when caseTypeFilter is closed', async () => {
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    await act(async () => {
      result.current.filterActions.setCaseTypeFilter('closed');
    });

    await waitFor(() => {
      const lastCall = vi.mocked(caseService.getAllCases).mock.calls.at(-1)?.[0] as any;
      expect(lastCall?.closedOnly).toBe(true);
    });
  });

  // ─── Investigator-only permissions ─────────────────────────

  it('investigator-only still uses getAllCases but sets isInvestigatorOnly', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [createBackendCase()],
      pagination: { ...defaultPagination, total: 1 },
    } as any);

    const { result } = renderHook(() => useCaseDashboard());
    await waitFor(() => expect(result.current.dashboardState.loading).toBe(false));

    expect(caseService.getAllCases).toHaveBeenCalled();
    expect(result.current.dashboardState.cases).toHaveLength(1);
    expect(result.current.dashboardState.permissions.isInvestigatorOnly).toBe(true);
  });
});
