import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCaseData, useCaseActions } from '../useCaseData';
import { caseService } from '@/features/cases/services/caseService';

/* ──────────── Mocks ──────────── */

const authMocks = {
  user: { userId: 'user-1' },
  hasInvestigatorRole: vi.fn(() => false),
  hasSupervisorRole: vi.fn(() => false),
  hasAdminRole: vi.fn(() => false),
};

const toastMock = { success: vi.fn(), error: vi.fn() };

vi.mock('@/features/cases/services/caseService', () => ({
  caseService: {
    getAllCases: vi.fn(),
    getUserAssignedCases: vi.fn(),
    createCase: vi.fn(),
    updateCase: vi.fn(),
    reopenCase: vi.fn(),
    abandonCase: vi.fn(),
    suspendCase: vi.fn(),
    resumeCase: vi.fn(),
    rejectCase: vi.fn(),
    approveCaseClosure: vi.fn(),
    approveCaseCreation: vi.fn(),
    rejectCaseCreation: vi.fn(),
    returnCaseForReview: vi.fn(),
  },
}));

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => authMocks,
}));

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => toastMock,
}));

vi.mock('@/features/cases/components/casesTable.utils', () => ({
  transformBackendCaseToUI: (c: any) => ({
    id: c.case_id,
    status: c.status,
    type: c.case_type ?? 'FRAUD',
    priority: c.priority ?? 'LOW',
    action: c.status === 'STATUS_00_DRAFT' ? 'Complete' : 'View',
  }),
}));

const makeCase = (overrides: any = {}) => ({
  case_id: 1,
  status: 'STATUS_20_IN_PROGRESS',
  case_type: 'FRAUD',
  priority: 'HIGH',
  ...overrides,
});

const defaultPagination = { total: 0, totalPages: 1, page: 1, limit: 20 };

/* ═══════════ useCaseData ═══════════ */

describe('useCaseData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.hasInvestigatorRole.mockReturnValue(false);
    authMocks.hasSupervisorRole.mockReturnValue(false);
    authMocks.hasAdminRole.mockReturnValue(false);

    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);
    vi.mocked(caseService.getUserAssignedCases).mockResolvedValue({
      cases: [],
      pagination: defaultPagination,
    } as any);
  });

  it('fetches all cases for supervisor on mount', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);
    vi.mocked(caseService.getAllCases).mockResolvedValue({
      cases: [makeCase()],
      pagination: defaultPagination,
    } as any);

    const { result } = renderHook(() => useCaseData());
    await act(async () => { await result.current.fetchCases(); });

    expect(caseService.getAllCases).toHaveBeenCalled();
    expect(result.current.cases).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it('fetches user-assigned cases for investigator only', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);
    vi.mocked(caseService.getUserAssignedCases).mockResolvedValue({
      cases: [makeCase()],
      pagination: defaultPagination,
    } as any);

    const { result } = renderHook(() => useCaseData());
    await act(async () => { await result.current.fetchCases(); });

    expect(caseService.getUserAssignedCases).toHaveBeenCalled();
    expect(result.current.cases).toHaveLength(1);
  });

  it('passes filters and sort to fetchCases', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);
    vi.mocked(caseService.getAllCases).mockResolvedValue({ cases: [], pagination: defaultPagination } as any);

    const { result } = renderHook(() => useCaseData());
    await act(async () => { await result.current.fetchCases('OPEN', 'HIGH', 'oldest'); });

    expect(caseService.getAllCases).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN', priority: 'HIGH', sortOrder: 'asc' }),
    );
  });

  it('sets errorState on fetch failure', async () => {
    authMocks.hasSupervisorRole.mockReturnValue(true);
    vi.mocked(caseService.getAllCases).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useCaseData());
    await act(async () => { await result.current.fetchCases(); });

    expect(result.current.errorState).toBe('Failed to load cases. Please try again.');
    expect(result.current.cases).toHaveLength(0);
  });

  it('refreshCases uses getAllCases regardless of role', async () => {
    authMocks.hasInvestigatorRole.mockReturnValue(true);
    vi.mocked(caseService.getAllCases).mockResolvedValue({ cases: [makeCase()], pagination: defaultPagination } as any);

    const { result } = renderHook(() => useCaseData());
    await act(async () => { await result.current.refreshCases('', '', 'recent'); });

    expect(caseService.getAllCases).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 'desc' }),
    );
  });

  it('refreshCases swallows errors silently', async () => {
    vi.mocked(caseService.getAllCases).mockRejectedValue(new Error('oops'));

    const { result } = renderHook(() => useCaseData());
    await act(async () => { await result.current.refreshCases(); });

    // Should not throw
    expect(result.current.cases).toHaveLength(0);
  });
});

/* ═══════════ useCaseActions ═══════════ */

describe('useCaseActions', () => {
  const refreshMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    refreshMock.mockResolvedValue(undefined);
  });

  // ─── handleCreate ─────────────────────────────────────────────

  describe('handleCreate', () => {
    const payload = {
      alertId: 100,
      priority: 'HIGH' as any,
      priorityScore: 5,
      alertType: 'FRAUD' as any,
      assignee: 'user-1',
    };

    it('creates case and shows success toast', async () => {
      vi.mocked(caseService.createCase).mockResolvedValue({ case_id: 1, status: 'DRAFT' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleCreate(payload); });

      expect(caseService.createCase).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith('Case Created', expect.stringContaining('Case 1'));
      expect(refreshMock).toHaveBeenCalled();
      expect(result.current.createCaseLoading).toBe(false);
    });

    it('creates case without alertId', async () => {
      vi.mocked(caseService.createCase).mockResolvedValue({ case_id: 2, status: 'DRAFT' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => {
        await result.current.handleCreate({ ...payload, alertId: undefined });
      });

      expect(toastMock.success).toHaveBeenCalled();
      const msg = toastMock.success.mock.calls[0][1] as string;
      expect(msg).not.toContain('Alert ID');
    });

    it('handles Error on create', async () => {
      vi.mocked(caseService.createCase).mockRejectedValue(new Error('create-err'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleCreate(payload); });

      expect(result.current.createCaseError).toBe('create-err');
      expect(toastMock.error).toHaveBeenCalledWith('Create Case Failed', 'create-err');
    });

    it('handles non-Error on create', async () => {
      vi.mocked(caseService.createCase).mockRejectedValue('string-err');

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleCreate(payload); });

      expect(result.current.createCaseError).toBe('Failed to create case');
    });
  });

  // ─── handleUpdate ─────────────────────────────────────────────

  describe('handleUpdate', () => {
    const updatePayload = { priority: 'HIGH' as any, priorityScore: 5, alertType: 'FRAUD' as any, assignee: 'u1' };

    it('updates case and shows success toast', async () => {
      vi.mocked(caseService.updateCase).mockResolvedValue({ case_id: 1, status: 'READY' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleUpdate(1, updatePayload); });

      expect(caseService.updateCase).toHaveBeenCalledWith(1, expect.objectContaining({ priority: 'HIGH' }));
      expect(toastMock.success).toHaveBeenCalledWith('Draft Case Completed', expect.any(String));
      expect(refreshMock).toHaveBeenCalled();
    });

    it('falls back to user.userId when no assignee', async () => {
      vi.mocked(caseService.updateCase).mockResolvedValue({ case_id: 1, status: 'READY' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleUpdate(1, { ...updatePayload, assignee: undefined }); });

      expect(caseService.updateCase).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ caseOwnerUserId: 'user-1' }),
      );
    });

    it('handles Error on update', async () => {
      vi.mocked(caseService.updateCase).mockRejectedValue(new Error('update-fail'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleUpdate(1, updatePayload); });

      expect(toastMock.error).toHaveBeenCalledWith('Update Case Failed', 'update-fail');
    });

    it('handles non-Error on update', async () => {
      vi.mocked(caseService.updateCase).mockRejectedValue(42);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleUpdate(1, updatePayload); });

      expect(toastMock.error).toHaveBeenCalledWith('Update Case Failed', 'Failed to update case');
    });
  });

  // ─── handleReopenSubmit ───────────────────────────────────────

  describe('handleReopenSubmit', () => {
    it('reopens case successfully', async () => {
      vi.mocked(caseService.reopenCase).mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReopenSubmit(1, '  reopen reason  '); });

      expect(caseService.reopenCase).toHaveBeenCalledWith(1, { reason: 'reopen reason' });
      expect(toastMock.success).toHaveBeenCalled();
      expect(refreshMock).toHaveBeenCalled();
    });

    it('handles not in a reopenable state error', async () => {
      vi.mocked(caseService.reopenCase).mockRejectedValue(new Error('not in a reopenable state'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReopenSubmit(1, 'reason'); });

      expect(toastMock.error).toHaveBeenCalledWith('Reopen Case Failed', expect.stringContaining('Case cannot be reopened'));
    });

    it('handles Unauthorized error', async () => {
      vi.mocked(caseService.reopenCase).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReopenSubmit(1, 'reason'); });

      expect(toastMock.error).toHaveBeenCalledWith('Reopen Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 403 error', async () => {
      vi.mocked(caseService.reopenCase).mockRejectedValue(new Error('403'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReopenSubmit(1, 'reason'); });

      expect(toastMock.error).toHaveBeenCalledWith('Reopen Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404 error', async () => {
      vi.mocked(caseService.reopenCase).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReopenSubmit(1, 'reason'); });

      expect(toastMock.error).toHaveBeenCalledWith('Reopen Case Failed', expect.stringContaining('Case Not Found'));
    });

    it('handles generic error', async () => {
      vi.mocked(caseService.reopenCase).mockRejectedValue('non-error');

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReopenSubmit(1, 'reason'); });

      expect(toastMock.error).toHaveBeenCalledWith('Reopen Case Failed', 'Failed to request case reopening. Please try again.');
    });
  });

  // ─── handleAbandonSubmit ──────────────────────────────────────

  describe('handleAbandonSubmit', () => {
    it('abandons case successfully', async () => {
      vi.mocked(caseService.abandonCase).mockResolvedValue({ status: 'ABANDONED' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleAbandonSubmit(1, 'bye', [10]); });

      expect(caseService.abandonCase).toHaveBeenCalledWith(1, { reason: 'bye' });
      expect(toastMock.success).toHaveBeenCalled();
    });

    it('handles draft status error', async () => {
      vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('Cannot abandon case other than draft status'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleAbandonSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('DRAFT'));
    });

    it('handles No complete new Case Task exists error', async () => {
      vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('No complete new Case Task exists'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleAbandonSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('Case cannot be abandoned'));
    });

    it('handles Unauthorized error', async () => {
      vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleAbandonSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404 error', async () => {
      vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleAbandonSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('Case Not Found'));
    });
  });

  // ─── handleSuspendSubmit ──────────────────────────────────────

  describe('handleSuspendSubmit', () => {
    it('suspends case successfully', async () => {
      vi.mocked(caseService.suspendCase).mockResolvedValue({ status: 'SUSPENDED' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleSuspendSubmit(1, 'srsn', [10, 20]); });

      expect(caseService.suspendCase).toHaveBeenCalledWith(1, { reason: 'srsn', taskIds: [10, 20] });
      expect(toastMock.success).toHaveBeenCalled();
    });

    it('handles not in a suspendable state error', async () => {
      vi.mocked(caseService.suspendCase).mockRejectedValue(new Error('not in a suspendable state'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleSuspendSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Suspend Case Failed', expect.stringContaining('Case cannot be suspended'));
    });

    it('handles 403 error', async () => {
      vi.mocked(caseService.suspendCase).mockRejectedValue(new Error('403'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleSuspendSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Suspend Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404 error', async () => {
      vi.mocked(caseService.suspendCase).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleSuspendSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Suspend Case Failed', expect.stringContaining('Case Not Found'));
    });

    it('uses normalizedErrorString for unknown errors', async () => {
      vi.mocked(caseService.suspendCase).mockRejectedValue(new Error('some "Investigate case" issue'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleSuspendSubmit(1, 'r', []); });

      // The normalized string replaces "Investigate case" → "Investigate Case"
      expect(toastMock.error).toHaveBeenCalledWith('Suspend Case Failed', expect.stringContaining('Investigate Case'));
    });

    it('uses empty-fallback message for non-Error', async () => {
      vi.mocked(caseService.suspendCase).mockRejectedValue(42);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleSuspendSubmit(1, 'r', []); });

      expect(toastMock.error).toHaveBeenCalledWith('Suspend Case Failed', 'Failed to suspend case. Please try again.');
    });
  });

  // ─── handleResumeSubmit ───────────────────────────────────────

  describe('handleResumeSubmit', () => {
    it('resumes case successfully', async () => {
      vi.mocked(caseService.resumeCase).mockResolvedValue({ status: 'IN_PROGRESS' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleResumeSubmit(1, ' reason '); });

      expect(caseService.resumeCase).toHaveBeenCalledWith(1, { reason: 'reason' });
      expect(toastMock.success).toHaveBeenCalled();
    });

    it('handles not in a resumable state', async () => {
      vi.mocked(caseService.resumeCase).mockRejectedValue(new Error('not in a resumable state'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleResumeSubmit(1, 'r'); });

      expect(toastMock.error).toHaveBeenCalledWith('Resume Case Failed', expect.stringContaining('Case cannot be resumed'));
    });

    it('handles Unauthorized', async () => {
      vi.mocked(caseService.resumeCase).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleResumeSubmit(1, 'r'); });

      expect(toastMock.error).toHaveBeenCalledWith('Resume Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404', async () => {
      vi.mocked(caseService.resumeCase).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleResumeSubmit(1, 'r'); });

      expect(toastMock.error).toHaveBeenCalledWith('Resume Case Failed', expect.stringContaining('Case Not Found'));
    });
  });

  // ─── handleRejectSubmit ───────────────────────────────────────

  describe('handleRejectSubmit', () => {
    const row = { id: 1 } as any;

    it('rejects case closure successfully', async () => {
      vi.mocked(caseService.rejectCase).mockResolvedValue({ status: 'REJECTED' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectSubmit(' reason ', row); });

      expect(caseService.rejectCase).toHaveBeenCalledWith(1, { rejectionReason: 'reason' });
      expect(toastMock.success).toHaveBeenCalled();
    });

    it('returns early when no selectedRow', async () => {
      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectSubmit('r', null); });

      expect(caseService.rejectCase).not.toHaveBeenCalled();
    });

    it('handles not in a rejectable state', async () => {
      vi.mocked(caseService.rejectCase).mockRejectedValue(new Error('not in a rejectable state'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectSubmit('r', row); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Failed', expect.stringContaining('Case cannot be rejected'));
    });

    it('handles 403', async () => {
      vi.mocked(caseService.rejectCase).mockRejectedValue(new Error('403'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectSubmit('r', row); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404', async () => {
      vi.mocked(caseService.rejectCase).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectSubmit('r', row); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Failed', expect.stringContaining('Case Not Found'));
    });

    it('handles Approval task validation failed', async () => {
      vi.mocked(caseService.rejectCase).mockRejectedValue(new Error('Approval task validation failed'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectSubmit('r', row); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Failed', expect.stringContaining('Approval task validation failed'));
    });
  });

  // ─── handleApproveSubmit ──────────────────────────────────────

  describe('handleApproveSubmit', () => {
    const row = { id: 1 } as any;
    const data = { finalOutcome: 'STATUS_82_CLOSED_CONFIRMED' as any };

    it('approves case closure successfully', async () => {
      vi.mocked(caseService.approveCaseClosure).mockResolvedValue({ status: 'CLOSED' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveSubmit(data, row, 10); });

      expect(caseService.approveCaseClosure).toHaveBeenCalledWith(1, data);
      expect(toastMock.success).toHaveBeenCalledWith('Case Closure Approved', expect.any(String));
    });

    it('returns early when no selectedRow', async () => {
      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveSubmit(data, null, 10); });

      expect(caseService.approveCaseClosure).not.toHaveBeenCalled();
    });

    it('handles not in pending approval status', async () => {
      vi.mocked(caseService.approveCaseClosure).mockRejectedValue(new Error('not in pending approval status'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveSubmit(data, row, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Failed', expect.stringContaining('Case cannot be approved'));
    });

    it('handles 403', async () => {
      vi.mocked(caseService.approveCaseClosure).mockRejectedValue(new Error('403'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveSubmit(data, row, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404', async () => {
      vi.mocked(caseService.approveCaseClosure).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveSubmit(data, row, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Failed', expect.stringContaining('Case Not Found'));
    });

    it('handles Approval task validation failed', async () => {
      vi.mocked(caseService.approveCaseClosure).mockRejectedValue(new Error('Approval task validation failed'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveSubmit(data, row, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Failed', expect.stringContaining('Approval Task Validation Failed'));
    });
  });

  // ─── handleApproveCreationSubmit ──────────────────────────────

  describe('handleApproveCreationSubmit', () => {
    it('approves case creation successfully', async () => {
      vi.mocked(caseService.approveCaseCreation).mockResolvedValue({ status: 'READY' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveCreationSubmit(1, 10); });

      expect(caseService.approveCaseCreation).toHaveBeenCalledWith(1);
      expect(toastMock.success).toHaveBeenCalledWith('Case Creation Approved', expect.any(String));
    });

    it('handles state error', async () => {
      vi.mocked(caseService.approveCaseCreation).mockRejectedValue(new Error('not in PENDING_CASE_CREATION_APPROVAL state'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveCreationSubmit(1, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Creation Failed', expect.stringContaining('Case cannot be approved'));
    });

    it('handles Unauthorized', async () => {
      vi.mocked(caseService.approveCaseCreation).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveCreationSubmit(1, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Creation Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404', async () => {
      vi.mocked(caseService.approveCaseCreation).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleApproveCreationSubmit(1, 10); });

      expect(toastMock.error).toHaveBeenCalledWith('Approve Case Creation Failed', expect.stringContaining('Case Not Found'));
    });
  });

  // ─── handleRejectCreationSubmit ───────────────────────────────

  describe('handleRejectCreationSubmit', () => {
    const data = { reason: 'not ready' } as any;

    it('rejects case creation successfully', async () => {
      vi.mocked(caseService.rejectCaseCreation).mockResolvedValue({ status: 'DRAFT' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectCreationSubmit(1, data); });

      expect(caseService.rejectCaseCreation).toHaveBeenCalledWith(1, data);
      expect(toastMock.success).toHaveBeenCalledWith('Case Creation Rejected', expect.any(String));
    });

    it('handles state error', async () => {
      vi.mocked(caseService.rejectCaseCreation).mockRejectedValue(new Error('not in PENDING_CASE_CREATION_APPROVAL state'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectCreationSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Creation Failed', expect.stringContaining('Case cannot be rejected'));
    });

    it('handles 403', async () => {
      vi.mocked(caseService.rejectCaseCreation).mockRejectedValue(new Error('403'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectCreationSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Creation Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404', async () => {
      vi.mocked(caseService.rejectCaseCreation).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleRejectCreationSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Reject Case Creation Failed', expect.stringContaining('Case Not Found'));
    });
  });

  // ─── handleReturnForReviewSubmit ──────────────────────────────

  describe('handleReturnForReviewSubmit', () => {
    const data = { reviewComments: 'needs more' } as any;

    it('returns case for review successfully', async () => {
      vi.mocked(caseService.returnCaseForReview).mockResolvedValue({ status: 'IN_PROGRESS' } as any);

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReturnForReviewSubmit(1, data); });

      expect(caseService.returnCaseForReview).toHaveBeenCalledWith(1, data);
      expect(toastMock.success).toHaveBeenCalledWith('Case Returned for Review', expect.any(String));
    });

    it('handles not in pending approval status', async () => {
      vi.mocked(caseService.returnCaseForReview).mockRejectedValue(new Error('not in pending approval status'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReturnForReviewSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Return Case for Review Failed', expect.stringContaining('Case cannot be returned'));
    });

    it('handles Unauthorized', async () => {
      vi.mocked(caseService.returnCaseForReview).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReturnForReviewSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Return Case for Review Failed', expect.stringContaining('Access Denied'));
    });

    it('handles 404', async () => {
      vi.mocked(caseService.returnCaseForReview).mockRejectedValue(new Error('404'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReturnForReviewSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Return Case for Review Failed', expect.stringContaining('Case Not Found'));
    });

    it('handles Approval task validation failed', async () => {
      vi.mocked(caseService.returnCaseForReview).mockRejectedValue(new Error('Approval task validation failed'));

      const { result } = renderHook(() => useCaseActions(refreshMock));
      await act(async () => { await result.current.handleReturnForReviewSubmit(1, data); });

      expect(toastMock.error).toHaveBeenCalledWith('Return Case for Review Failed', expect.stringContaining('Approval Task Validation Failed'));
    });
  });

  // ─── setCreateCaseError ───────────────────────────────────────

  it('setCreateCaseError updates error state', async () => {
    const { result } = renderHook(() => useCaseActions(refreshMock));
    act(() => result.current.setCreateCaseError('custom error'));
    expect(result.current.createCaseError).toBe('custom error');
  });
});
