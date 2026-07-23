import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCaseData, useCaseActions } from '../useCaseData';
import { caseService } from '../../services/caseService';
import { useAuth } from '../../../auth/components/AuthContext';
import { useToast } from '../../../../shared/providers/ToastProvider';
import { transformBackendCaseToUI } from '../../components/casesTable.utils';

vi.mock('../../services/caseService');
vi.mock('../../../auth/components/AuthContext');
vi.mock('../../../../shared/providers/ToastProvider');
vi.mock('../../components/casesTable.utils', () => ({
  transformBackendCaseToUI: vi.fn((case_) => ({
    id: case_.case_id || case_.id,
    status: case_.status,
    ...case_,
  })),
}));

describe('useCaseData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as vi.Mock).mockReturnValue({
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => true,
      hasAdminRole: () => false,
    });
  });

  it('fetches cases for supervisor/admin', async () => {
    const mockResponse = {
      cases: [
        { case_id: 'CASE-1', status: 'IN_PROGRESS' },
        { case_id: 'CASE-2', status: 'CLOSED' },
      ],
    };
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(caseService.getAllCases).toHaveBeenCalled();
    expect(result.current.cases.length).toBeGreaterThan(0);
  });

  it('fetches cases for investigator only', async () => {
    (useAuth as vi.Mock).mockReturnValue({
      hasInvestigatorRole: () => true,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    const mockResponse = {
      cases: [{ case_id: 'CASE-1', status: 'IN_PROGRESS' }],
    };
    (caseService.getUserAssignedCases as vi.Mock).mockResolvedValue(
      mockResponse,
    );

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(caseService.getUserAssignedCases).toHaveBeenCalled();
  });

  it('handles error when fetching cases fails', async () => {
    const error = new Error('Failed to fetch');
    (caseService.getAllCases as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.errorState).toBeTruthy();
    });
  });

  it('fetches cases with filters', async () => {
    const mockResponse = {
      cases: [{ case_id: 'CASE-1', status: 'IN_PROGRESS' }],
    };
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases(
        'STATUS_20_IN_PROGRESS',
        'HIGH',
        'recent',
      );
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(caseService.getAllCases).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        sortBy: 'updated_at',
        sortOrder: 'desc',
      }),
    );
  });

  it('refreshes cases', async () => {
    const mockResponse = {
      cases: [{ case_id: 'CASE-1', status: 'IN_PROGRESS' }],
    };
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.refreshCases(
        'STATUS_20_IN_PROGRESS',
        'HIGH',
        'recent',
      );
    });

    expect(caseService.getAllCases).toHaveBeenCalled();
    expect(result.current.cases.length).toBeGreaterThan(0);
  });

  it('handles refresh errors gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (caseService.getAllCases as vi.Mock).mockRejectedValue(
      new Error('Refresh failed'),
    );

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.refreshCases();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('allows setting cases directly', () => {
    const { result } = renderHook(() => useCaseData());

    act(() => {
      result.current.setCases([{ id: 'CASE-1', status: 'IN_PROGRESS' }] as any);
    });

    expect(result.current.cases).toHaveLength(1);
  });
});

describe('useCaseActions', () => {
  const mockRefreshCases = vi.fn();
  const mockSuccess = vi.fn();
  const mockError = vi.fn();
  const mockUser = { userId: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as vi.Mock).mockReturnValue({
      user: mockUser,
    });
    (useToast as vi.Mock).mockReturnValue({
      success: mockSuccess,
      error: mockError,
    });
  });

  it('creates a case successfully', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
    };
    (caseService.createCase as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleCreate({
        alertId: 'ALERT-1',
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
      });
    });

    expect(caseService.createCase).toHaveBeenCalledWith({
      alertId: 'ALERT-1',
      priorityScore: 90,
      alertType: 'FRAUD',
    });
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockRefreshCases).toHaveBeenCalled();
    expect(result.current.createCaseLoading).toBe(false);
  });

  it('handles case creation error', async () => {
    const error = new Error('Creation failed');
    (caseService.createCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleCreate({
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
      });
    });

    expect(mockError).toHaveBeenCalled();
    expect(result.current.createCaseError).toBeTruthy();
    expect(result.current.createCaseLoading).toBe(false);
  });

  it('updates a case successfully', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      status: 'STATUS_02_READY_FOR_ASSIGNMENT',
    };
    (caseService.updateCase as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleUpdate('CASE-123', {
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
        assignee: 'user-1',
      });
    });

    expect(caseService.updateCase).toHaveBeenCalledWith(
      'CASE-123',
      expect.objectContaining({
        priority: 'HIGH',
        caseType: 'FRAUD',
      }),
    );
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockRefreshCases).toHaveBeenCalled();
  });

  it('reopens a case successfully', async () => {
    (caseService.reopenCase as vi.Mock).mockResolvedValue({
      case_id: 'CASE-123',
      status: 'STATUS_30_PENDING_REOPENING',
    });

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleReopenSubmit('CASE-123', 'New evidence found');
    });

    expect(caseService.reopenCase).toHaveBeenCalledWith('CASE-123', {
      reason: 'New evidence found',
    });
    expect(mockSuccess).toHaveBeenCalled();
    expect(mockRefreshCases).toHaveBeenCalled();
  });

  it('handles reopen error with specific messages', async () => {
    const error = new Error('not in a reopenable state');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleReopenSubmit('CASE-123', 'Reason');
    });

    expect(mockError).toHaveBeenCalledWith(
      'Reopen Case Failed',
      expect.stringContaining('Case cannot be reopened'),
    );
  });

  it('abandons a case successfully', async () => {
    (caseService.abandonCase as vi.Mock).mockResolvedValue({
      case_id: 'CASE-123',
      status: 'STATUS_99_ABANDONED',
    });

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleAbandonSubmit(
        'CASE-123',
        'No longer relevant',
      );
    });

    expect(caseService.abandonCase).toHaveBeenCalledWith('CASE-123', {
      reason: 'No longer relevant',
    });
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('suspends a case successfully', async () => {
    (caseService.suspendCase as vi.Mock).mockResolvedValue({
      case_id: 'CASE-123',
      status: 'STATUS_21_SUSPENDED',
    });

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleSuspendSubmit('CASE-123', 'Awaiting info');
    });

    expect(caseService.suspendCase).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('resumes a case successfully', async () => {
    (caseService.resumeCase as vi.Mock).mockResolvedValue({
      case_id: 'CASE-123',
      status: 'STATUS_20_IN_PROGRESS',
    });

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleResumeSubmit('CASE-123', 'Info received');
    });

    expect(caseService.resumeCase).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('rejects a case closure', async () => {
    const mockCase = { case_id: 'CASE-123', status: 'STATUS_03_RETURNED' };
    (caseService.rejectCase as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleRejectSubmit('Insufficient evidence', {
        id: 'CASE-123',
      } as any);
    });

    expect(caseService.rejectCase).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('approves case closure', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      status: 'STATUS_82_CLOSED_CONFIRMED',
    };
    (caseService.approveCaseClosure as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleApproveSubmit(
        { finalOutcome: 'STATUS_82_CLOSED_CONFIRMED' },
        { id: 'CASE-123' } as any,
      );
    });

    expect(caseService.approveCaseClosure).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('approves case creation', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      status: 'STATUS_02_READY_FOR_ASSIGNMENT',
    };
    (caseService.approveCaseCreation as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleApproveCreationSubmit('CASE-123');
    });

    expect(caseService.approveCaseCreation).toHaveBeenCalledWith('CASE-123');
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('rejects case creation', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      status: 'STATUS_99_ABANDONED',
    };
    (caseService.rejectCaseCreation as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleRejectCreationSubmit('CASE-123', {
        reason: 'Invalid data',
      });
    });

    expect(caseService.rejectCaseCreation).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('returns case for review', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      status: 'STATUS_03_RETURNED',
    };
    (caseService.returnCaseForReview as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleReturnForReviewSubmit('CASE-123', {
        reviewComments: 'Needs more work',
      });
    });

    expect(caseService.returnCaseForReview).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('handles reject submit with null selectedRow', async () => {
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleRejectSubmit('Reason', null);
    });

    expect(caseService.rejectCase).not.toHaveBeenCalled();
  });

  it('handles approve submit with null selectedRow', async () => {
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    await act(async () => {
      await result.current.handleApproveSubmit(
        { finalOutcome: 'STATUS_82_CLOSED_CONFIRMED' },
        null,
      );
    });

    expect(caseService.approveCaseClosure).not.toHaveBeenCalled();
  });

  // Error branch tests for each handler
  it('handles reopen Unauthorized error', async () => {
    (caseService.reopenCase as vi.Mock).mockRejectedValue(
      new Error('Unauthorized'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReopenSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reopen Case Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles reopen 404 error', async () => {
    (caseService.reopenCase as vi.Mock).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReopenSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reopen Case Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles reopen generic error', async () => {
    (caseService.reopenCase as vi.Mock).mockRejectedValue(
      new Error('something'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReopenSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reopen Case Failed',
      expect.stringContaining('Failed to request case reopening'),
    );
  });

  it('handles abandon draft status error', async () => {
    (caseService.abandonCase as vi.Mock).mockRejectedValue(
      new Error('Cannot abandon case other than draft status'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleAbandonSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Abandon Case Failed',
      expect.stringContaining('Case cannot be abandoned'),
    );
  });

  it('handles abandon No complete new Case Task error', async () => {
    (caseService.abandonCase as vi.Mock).mockRejectedValue(
      new Error('No complete new Case Task exists'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleAbandonSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Abandon Case Failed',
      expect.stringContaining('Case cannot be abandoned'),
    );
  });

  it('handles abandon 403 error', async () => {
    (caseService.abandonCase as vi.Mock).mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleAbandonSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Abandon Case Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles abandon 404 error', async () => {
    (caseService.abandonCase as vi.Mock).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleAbandonSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Abandon Case Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles abandon generic error', async () => {
    (caseService.abandonCase as vi.Mock).mockRejectedValue(
      new Error('unknown'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleAbandonSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Abandon Case Failed',
      expect.stringContaining('Failed to abandon case'),
    );
  });

  it('handles suspend not suspendable error', async () => {
    (caseService.suspendCase as vi.Mock).mockRejectedValue(
      new Error('not in a suspendable state'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleSuspendSubmit(1, 'Reason', [1]);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Suspend Case Failed',
      expect.stringContaining('Case cannot be suspended'),
    );
  });

  it('handles suspend 403 error', async () => {
    (caseService.suspendCase as vi.Mock).mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleSuspendSubmit(1, 'Reason', [1]);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Suspend Case Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles suspend 404 error', async () => {
    (caseService.suspendCase as vi.Mock).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleSuspendSubmit(1, 'Reason', [1]);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Suspend Case Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles suspend normalizedErrorString fallback', async () => {
    (caseService.suspendCase as vi.Mock).mockRejectedValue(
      new Error('Investigate case task error'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleSuspendSubmit(1, 'Reason', [1]);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Suspend Case Failed',
      expect.any(String),
    );
  });

  it('handles resume not resumable error', async () => {
    (caseService.resumeCase as vi.Mock).mockRejectedValue(
      new Error('not in a resumable state'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleResumeSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Resume Case Failed',
      expect.stringContaining('Case cannot be resumed'),
    );
  });

  it('handles resume 403 error', async () => {
    (caseService.resumeCase as vi.Mock).mockRejectedValue(
      new Error('Unauthorized'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleResumeSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Resume Case Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles resume 404 error', async () => {
    (caseService.resumeCase as vi.Mock).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleResumeSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Resume Case Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles resume generic error', async () => {
    (caseService.resumeCase as vi.Mock).mockRejectedValue(new Error('random'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleResumeSubmit(1, 'Reason');
    });
    expect(mockError).toHaveBeenCalledWith(
      'Resume Case Failed',
      expect.stringContaining('Failed to resume case'),
    );
  });

  it('handles reject not rejectable error', async () => {
    (caseService.rejectCase as vi.Mock).mockRejectedValue(
      new Error('not in a rejectable state'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectSubmit('Reason', { id: 1 } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Failed',
      expect.stringContaining('Case cannot be rejected'),
    );
  });

  it('handles reject 403 error', async () => {
    (caseService.rejectCase as vi.Mock).mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectSubmit('Reason', { id: 1 } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles reject 404 error', async () => {
    (caseService.rejectCase as vi.Mock).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectSubmit('Reason', { id: 1 } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles reject Approval task validation failed error', async () => {
    (caseService.rejectCase as vi.Mock).mockRejectedValue(
      new Error('Approval task validation failed'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectSubmit('Reason', { id: 1 } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Failed',
      'Approval task validation failed',
    );
  });

  it('handles approve not in pending approval error', async () => {
    (caseService.approveCaseClosure as vi.Mock).mockRejectedValue(
      new Error('not in pending approval status'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveSubmit({ finalOutcome: 'STATUS_82' }, {
        id: 1,
      } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Failed',
      expect.stringContaining('Case cannot be approved'),
    );
  });

  it('handles approve 403 error', async () => {
    (caseService.approveCaseClosure as vi.Mock).mockRejectedValue(
      new Error('403'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveSubmit({ finalOutcome: 'STATUS_82' }, {
        id: 1,
      } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles approve 404 error', async () => {
    (caseService.approveCaseClosure as vi.Mock).mockRejectedValue(
      new Error('404'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveSubmit({ finalOutcome: 'STATUS_82' }, {
        id: 1,
      } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles approve Approval task validation failed error', async () => {
    (caseService.approveCaseClosure as vi.Mock).mockRejectedValue(
      new Error('Approval task validation failed'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveSubmit({ finalOutcome: 'STATUS_82' }, {
        id: 1,
      } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Failed',
      expect.stringContaining('Approval Task Validation Failed'),
    );
  });

  it('handles approve creation not in PENDING state error', async () => {
    (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(
      new Error('not in PENDING_CASE_CREATION_APPROVAL state'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveCreationSubmit(1);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Creation Failed',
      expect.stringContaining('Case cannot be approved'),
    );
  });

  it('handles approve creation 403 error', async () => {
    (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(
      new Error('403'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveCreationSubmit(1);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Creation Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles approve creation 404 error', async () => {
    (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(
      new Error('404'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveCreationSubmit(1);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Creation Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles reject creation not in PENDING state error', async () => {
    (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(
      new Error('not in PENDING_CASE_CREATION_APPROVAL state'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectCreationSubmit(1, { reason: 'x' });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Creation Failed',
      expect.stringContaining('Case cannot be rejected'),
    );
  });

  it('handles reject creation 403 error', async () => {
    (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(
      new Error('Unauthorized'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectCreationSubmit(1, { reason: 'x' });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Creation Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles reject creation 404 error', async () => {
    (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(
      new Error('404'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectCreationSubmit(1, { reason: 'x' });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Creation Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles return for review not in pending approval error', async () => {
    (caseService.returnCaseForReview as vi.Mock).mockRejectedValue(
      new Error('not in pending approval status'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReturnForReviewSubmit(1, {
        reviewComments: 'x',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Return Case for Review Failed',
      expect.stringContaining('Case cannot be returned'),
    );
  });

  it('handles return for review 403 error', async () => {
    (caseService.returnCaseForReview as vi.Mock).mockRejectedValue(
      new Error('403'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReturnForReviewSubmit(1, {
        reviewComments: 'x',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Return Case for Review Failed',
      expect.stringContaining('Access Denied'),
    );
  });

  it('handles return for review 404 error', async () => {
    (caseService.returnCaseForReview as vi.Mock).mockRejectedValue(
      new Error('404'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReturnForReviewSubmit(1, {
        reviewComments: 'x',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Return Case for Review Failed',
      expect.stringContaining('Case Not Found'),
    );
  });

  it('handles return for review Approval task validation failed error', async () => {
    (caseService.returnCaseForReview as vi.Mock).mockRejectedValue(
      new Error('Approval task validation failed'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReturnForReviewSubmit(1, {
        reviewComments: 'x',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Return Case for Review Failed',
      expect.stringContaining('Approval Task Validation Failed'),
    );
  });

  it('handles update error', async () => {
    (caseService.updateCase as vi.Mock).mockRejectedValue(
      new Error('Update failed'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleUpdate(1, {
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Update Case Failed',
      'Update failed',
    );
    expect(result.current.createCaseError).toBe('Update failed');
  });

  it('handles update without assignee uses user.userId', async () => {
    const mockCase = { case_id: 1, status: 'STATUS_02' };
    (caseService.updateCase as vi.Mock).mockResolvedValue(mockCase);
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleUpdate(1, {
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
      });
    });
    expect(caseService.updateCase).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ caseOwnerUserId: 'user-1' }),
    );
  });

  it('handles create with alertId includes alert info in success', async () => {
    (caseService.createCase as vi.Mock).mockResolvedValue({
      case_id: 1,
      status: 'STATUS_01',
    });
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleCreate({
        alertId: 5,
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
      });
    });
    expect(mockSuccess).toHaveBeenCalledWith(
      'Case Created',
      expect.stringContaining('Alert ID: 5'),
    );
  });

  it('handles create non-Error rejection', async () => {
    (caseService.createCase as vi.Mock).mockRejectedValue('string error');
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleCreate({
        priority: 'HIGH',
        priorityScore: 90,
        alertType: 'FRAUD',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Create Case Failed',
      'Failed to create case',
    );
  });

  it('clears createCaseError via setCreateCaseError', async () => {
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    act(() => {
      result.current.setCreateCaseError('some error');
    });
    expect(result.current.createCaseError).toBe('some error');
    act(() => {
      result.current.setCreateCaseError('');
    });
    expect(result.current.createCaseError).toBe('');
  });

  it('handles suspend with non-Error rejection', async () => {
    (caseService.suspendCase as vi.Mock).mockRejectedValue('non-error');
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleSuspendSubmit(1, 'Reason', [1]);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Suspend Case Failed',
      expect.stringContaining('Failed to suspend case'),
    );
  });

  it('handles reject generic error', async () => {
    (caseService.rejectCase as vi.Mock).mockRejectedValue(
      new Error('random error'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectSubmit('Reason', { id: 1 } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Failed',
      expect.stringContaining('Failed to reject case closure'),
    );
  });

  it('handles approve generic error', async () => {
    (caseService.approveCaseClosure as vi.Mock).mockRejectedValue(
      new Error('random'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveSubmit({ finalOutcome: 'STATUS_82' }, {
        id: 1,
      } as any);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Failed',
      expect.stringContaining('Failed to approve case closure'),
    );
  });

  it('handles approve creation generic error', async () => {
    (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(
      new Error('random'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleApproveCreationSubmit(1);
    });
    expect(mockError).toHaveBeenCalledWith(
      'Approve Case Creation Failed',
      expect.stringContaining('Failed to approve case creation'),
    );
  });

  it('handles reject creation generic error', async () => {
    (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(
      new Error('random'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleRejectCreationSubmit(1, { reason: 'x' });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Reject Case Creation Failed',
      expect.stringContaining('Failed to reject case creation'),
    );
  });

  it('handles return for review generic error', async () => {
    (caseService.returnCaseForReview as vi.Mock).mockRejectedValue(
      new Error('random'),
    );
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));
    await act(async () => {
      await result.current.handleReturnForReviewSubmit(1, {
        reviewComments: 'x',
      });
    });
    expect(mockError).toHaveBeenCalledWith(
      'Return Case for Review Failed',
      expect.stringContaining('Failed to return case for review'),
    );
  });
});
