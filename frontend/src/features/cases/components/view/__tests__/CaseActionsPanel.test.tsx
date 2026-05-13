import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseActionsPanel from '../CaseActionsPanel';
import { TaskStatus } from '../../../services/taskService';

const mockGetUser = vi.fn(() => ({ userId: 'user-1', username: 'testuser' }));
vi.mock('@/features/auth/services/authService', () => ({
  default: { getUser: () => mockGetUser() },
}));

const mockHasComplianceOfficerRole = vi.fn(() => false);
const mockHasSupervisorRole = vi.fn(() => false);
vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
    hasSupervisorRole: mockHasSupervisorRole,
  }),
}));

const mockGetCaseDetails = vi.fn().mockResolvedValue({
  case_owner_user_id: 'user-1',
  status: 'STATUS_20_IN_PROGRESS',
});
vi.mock('../../../services/caseService', () => ({
  caseService: {
    getCaseDetails: (...args: any[]) => mockGetCaseDetails(...args),
  },
}));

const mockFetchTasks = vi.fn().mockResolvedValue([]);
let mockTasks: any[] = [];
vi.mock('../../../hooks/useCaseTasks', () => ({
  useCaseTasks: () => ({ tasks: mockTasks, fetchTasks: mockFetchTasks }),
}));

describe('CaseActionsPanel', () => {
  const baseCaseData = {
    id: 1,
    status: 'STATUS_20_IN_PROGRESS',
    action: 'None',
    tasks: [],
    type: 'FRAUD',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasComplianceOfficerRole.mockReturnValue(false);
    mockHasSupervisorRole.mockReturnValue(false);
    mockGetUser.mockReturnValue({ userId: 'user-1', username: 'testuser' });
    mockGetCaseDetails.mockResolvedValue({
      case_owner_user_id: 'user-1',
      status: 'STATUS_20_IN_PROGRESS',
    });
    mockTasks = [];
  });

  it('renders without crashing', () => {
    const { container } = render(
      <CaseActionsPanel
        caseData={baseCaseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
      />,
    );
    expect(container).toBeTruthy();
  });

  it('returns null for compliance officer', () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    const { container } = render(
      <CaseActionsPanel
        caseData={baseCaseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows Complete Case button when action is Complete', async () => {
    const onComplete = vi.fn();
    const caseData = { ...baseCaseData, action: 'Complete' };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onComplete={onComplete}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Complete Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Complete Case'));
    expect(onComplete).toHaveBeenCalledWith(caseData);
  });

  it('shows Close Case when all investigation tasks are completed and user is owner', async () => {
    const onCloseCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_20_IN_PROGRESS',
      tasks: [{ name: 'Investigate Alert', status: 'STATUS_30_COMPLETED' }],
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onCloseCase={onCloseCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Close Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Case'));
    expect(onCloseCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Close Case for FRAUD_AND_AML when all sub-cases closed', async () => {
    mockHasSupervisorRole.mockReturnValue(true);
    const onCloseCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      type: 'FRAUD_AND_AML',
      status: 'STATUS_20_IN_PROGRESS',
      tasks: [],
    };
    const subCases = [
      { id: 2, status: 'STATUS_82_CLOSED_CONFIRMED' },
      { id: 3, status: 'STATUS_81_CLOSED_REFUTED' },
    ] as any[];
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={subCases}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onCloseCase={onCloseCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Close Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Case'));
    expect(onCloseCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Review Case Closure for pending final approval', async () => {
    const onApproveCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_22_PENDING_FINAL_APPROVAL',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={true}
        onApproveCase={onApproveCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Review Case Closure')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Review Case Closure'));
    expect(onApproveCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Approve/Reject Case Creation for pending creation approval', async () => {
    const onApproveCaseCreation = vi.fn();
    const onRejectCaseCreation = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={true}
        onApproveCaseCreation={onApproveCaseCreation}
        onRejectCaseCreation={onRejectCaseCreation}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Approve Case Creation')).toBeInTheDocument();
      expect(screen.getByText('Reject Case Creation')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Approve Case Creation'));
    expect(onApproveCaseCreation).toHaveBeenCalledWith(caseData);
    fireEvent.click(screen.getByText('Reject Case Creation'));
    expect(onRejectCaseCreation).toHaveBeenCalledWith(caseData);
  });

  it('shows Approve/Reject Case Reopening for pending reopening', async () => {
    const onApproveCaseReopen = vi.fn();
    const onRejectCaseReopen = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={true}
        onApproveCaseReopen={onApproveCaseReopen}
        onRejectCaseReopen={onRejectCaseReopen}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Approve Case Reopening')).toBeInTheDocument();
      expect(screen.getByText('Reject Case Reopening')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Approve Case Reopening'));
    expect(onApproveCaseReopen).toHaveBeenCalledWith(caseData);
    fireEvent.click(screen.getByText('Reject Case Reopening'));
    expect(onRejectCaseReopen).toHaveBeenCalledWith(caseData);
  });

  it('shows Reopen for closed confirmed case with completed STR task', async () => {
    mockTasks = [
      {
        name: 'SAR/STR Filing',
        status: TaskStatus.STATUS_30_COMPLETED,
        task_id: 10,
      },
    ];
    const onReopenCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_82_CLOSED_CONFIRMED',
      type: 'FRAUD',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={onReopenCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Reopen Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Reopen Case'));
    expect(onReopenCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Reopen for closed refuted case (non-FRAUD_AND_AML)', async () => {
    const onReopenCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_81_CLOSED_REFUTED',
      type: 'FRAUD',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={onReopenCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Reopen Case')).toBeInTheDocument();
    });
  });

  it('does not show Reopen for FRAUD_AND_AML cases', async () => {
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_82_CLOSED_CONFIRMED',
      type: 'FRAUD_AND_AML',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByText('Reopen Case')).not.toBeInTheDocument();
    });
  });

  it('shows Abandon Case for draft cases', async () => {
    const onAbandonCase = vi.fn();
    const caseData = { ...baseCaseData, status: 'STATUS_00_DRAFT' };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onAbandonCase={onAbandonCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Abandon Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Abandon Case'));
    expect(onAbandonCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Suspend Case for in-progress cases with in-progress tasks', async () => {
    const onSuspendCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_20_IN_PROGRESS',
      tasks: [{ name: 'Investigate', status: 'STATUS_20_IN_PROGRESS' }],
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onSuspendCase={onSuspendCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Suspend Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suspend Case'));
    expect(onSuspendCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Resume Case for suspended cases', async () => {
    const onResumeCase = vi.fn();
    const caseData = { ...baseCaseData, status: 'STATUS_21_SUSPENDED' };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onResumeCase={onResumeCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Resume Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Resume Case'));
    expect(onResumeCase).toHaveBeenCalledWith(caseData);
  });

  it('returns null when no actions are available', async () => {
    const { container } = render(
      <CaseActionsPanel
        caseData={baseCaseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('.flex.flex-wrap')).toBeNull();
    });
  });

  it('handles case details fetch failure gracefully', async () => {
    mockGetCaseDetails.mockRejectedValue(new Error('Network error'));
    const { container } = render(
      <CaseActionsPanel
        caseData={baseCaseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
      />,
    );
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('shows Close Case for status containing IN PROGRESS text', async () => {
    const onCloseCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'IN PROGRESS',
      tasks: [{ name: 'Investigate Alert', status: 'STATUS_30_COMPLETED' }],
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onCloseCase={onCloseCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Close Case')).toBeInTheDocument();
    });
  });

  it('shows Resume for status containing SUSPENDED text', async () => {
    const onResumeCase = vi.fn();
    const caseData = { ...baseCaseData, status: 'CASE SUSPENDED' };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onResumeCase={onResumeCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Resume Case')).toBeInTheDocument();
    });
  });

  it('does not show Close Case when user is not case owner', async () => {
    mockGetUser.mockReturnValue({ userId: 'other-user', username: 'other' });
    mockGetCaseDetails.mockResolvedValue({ case_owner_user_id: 'user-1' });
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_20_IN_PROGRESS',
      tasks: [{ name: 'Investigate Alert', status: 'STATUS_30_COMPLETED' }],
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onCloseCase={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByText('Close Case')).not.toBeInTheDocument();
    });
  });

  it('shows Reopen for STATUS_83_CLOSED_INCONCLUSIVE', async () => {
    const onReopenCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_83_CLOSED_INCONCLUSIVE',
      type: 'FRAUD',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={onReopenCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Reopen Case')).toBeInTheDocument();
    });
  });

  it('does not show Reopen for confirmed case without completed STR task', async () => {
    mockTasks = [];
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_82_CLOSED_CONFIRMED',
      type: 'FRAUD',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByText('Reopen Case')).not.toBeInTheDocument();
    });
  });
});
