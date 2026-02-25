import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useCaseDashboard from '../useCaseDashboard';
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

type BackendCase = {
  case_id: string;
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
  case_id: 'CASE-001',
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

    (caseService.getUserAssignedCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
    });
    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValue({
      cases: [],
    });
  });

  it('fetches investigator-only cases and applies search filtering', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);
    const backendCases = [
      createBackendCase({ case_id: 'CASE-100' }),
      createBackendCase({ case_id: 'CASE-200', case_type: 'AML' }),
    ];

    (
      caseService.getUserAssignedCases as unknown as vi.Mock
    ).mockResolvedValueOnce({
      cases: backendCases,
    });

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(caseService.getUserAssignedCases).toHaveBeenCalledWith({
      status: undefined,
      priority: undefined,
      includeTaskAssignments: true,
      includeOwnedCases: true,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });

    expect(result.current.dashboardState.cases).toHaveLength(2);

    act(() => {
      result.current.filterActions.setSearch('200');
    });

    expect(result.current.dashboardState.cases).toHaveLength(1);
    expect(result.current.dashboardState.cases[0].id).toBe('CASE-200');
  });

  it('opens the view modal when a route param matches a case id', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);
    routeMock.params = { caseId: 'CASE-777' };

    (caseService.getAllCases as unknown as vi.Mock).mockResolvedValueOnce({
      cases: [createBackendCase({ case_id: 'CASE-777' })],
    });

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(caseService.getAllCases).toHaveBeenCalledWith({
      status: undefined,
      priority: undefined,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });

    expect(result.current.modalState.isViewOpen).toBe(true);
    expect(result.current.modalState.selectedRow?.id).toBe('CASE-777');

    act(() => {
      const firstRow = result.current.dashboardState.cases[0];
      result.current.dashboardActions.handleView(firstRow);
    });

    expect(routeMock.navigate).toHaveBeenCalledWith('/cases/CASE-777');
  });

  it('surfaces an error state when the service call fails', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);
    (
      caseService.getUserAssignedCases as unknown as vi.Mock
    ).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useCaseDashboard());

    await waitFor(() =>
      expect(result.current.dashboardState.loading).toBe(false),
    );

    expect(result.current.dashboardState.errorState).toBe(
      'Failed to load cases. Please try again.',
    );
    expect(result.current.dashboardState.cases).toHaveLength(0);
  });
});
