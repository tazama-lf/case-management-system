import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ReassignTaskModal from '../ReassignTaskModal';
import type { UnifiedWorkQueueTask } from '../../../types/task.types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockFetchInvestigatorsList = vi.fn();
const mockFetchComplianceOfficersList = vi.fn();
let mockLoadingInvestigators = false;
let mockInvestigators: Array<{ id: string; name: string; firstName: string; lastName: string }> = [];
let mockComplianceOfficers: Array<{ id: string; name: string; firstName: string; lastName: string }> = [];
let mockSupervisors: Array<{ id: string; name: string; firstName: string; lastName: string }> = [];

vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    fetchInvestigatorsList: mockFetchInvestigatorsList,
    loadingInvestigators: mockLoadingInvestigators,
    investigators: mockInvestigators,
    fetchComplianceOfficersList: mockFetchComplianceOfficersList,
    complianceOfficers: mockComplianceOfficers,
    supervisors: mockSupervisors,
  }),
}));

const mockGetUser = vi.fn();
vi.mock('../../../../auth/services/authService', () => ({
  default: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
}));

let mockHasComplianceOfficerRole = vi.fn(() => false);
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
  }),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const baseTask: UnifiedWorkQueueTask = {
  id: 123,
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 100,
  assignee: 'inv-old',
  assigneeName: 'Old Assignee',
  description: 'Review suspicious transaction',
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onReassign: vi.fn().mockResolvedValue(undefined),
  task: baseTask,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ReassignTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadingInvestigators = false;
    mockInvestigators = [
      { id: 'inv-1', name: 'inv1', firstName: 'John', lastName: 'Doe' },
      { id: 'inv-2', name: 'inv2', firstName: 'Jane', lastName: 'Smith' },
    ];
    mockComplianceOfficers = [];
    mockSupervisors = [];
    mockHasComplianceOfficerRole = vi.fn(() => false);
    mockGetUser.mockReturnValue({
      userId: 'user-1',
      fullName: 'Current User',
      email: 'user@test.com',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* --- Visibility --- */

  it('does not render when open is false', () => {
    render(<ReassignTaskModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Reassign Task')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(<ReassignTaskModal {...defaultProps} task={null} />);
    expect(screen.queryByText('Reassign Task')).not.toBeInTheDocument();
  });

  it('does not render when task is undefined', () => {
    render(<ReassignTaskModal {...defaultProps} task={undefined} />);
    expect(screen.queryByText('Reassign Task')).not.toBeInTheDocument();
  });

  /* --- Rendering --- */

  it('renders heading and task info', () => {
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByText('Reassign Task')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
  });

  it('displays current assignee with full name from investigators list', () => {
    mockInvestigators = [
      { id: 'inv-old', name: 'old_inv', firstName: 'Old', lastName: 'Person' },
      ...mockInvestigators,
    ];
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByText(/Old Person/)).toBeInTheDocument();
  });

  it('displays Unassigned when no assignee info', () => {
    const noAssigneeTask = { ...baseTask, assignee: undefined, assigneeName: undefined };
    render(<ReassignTaskModal {...defaultProps} task={noAssigneeTask} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows loading state when fetching investigators', () => {
    mockLoadingInvestigators = true;
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByText('Loading investigators...')).toBeInTheDocument();
  });

  it('renders investigator dropdown excluding current assignee and current user', () => {
    render(<ReassignTaskModal {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    // inv-1 and inv-2 should be visible, inv-old is not in the list
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('shows no investigators available message when list is empty after filtering', () => {
    mockInvestigators = [];
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByText(/No other investigators available/i)).toBeInTheDocument();
  });

  it('renders justification textarea with required indicator', () => {
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Provide a reason for reassigning/i)).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders audit note message', () => {
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByText(/recorded in the audit log/i)).toBeInTheDocument();
  });

  /* --- Interactions --- */

  it('disables confirm button when no assignee or justification', () => {
    render(<ReassignTaskModal {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /Confirm Reassignment/i });
    expect(btn).toBeDisabled();
  });

  it('enables confirm button when assignee and justification provided', async () => {
    const user = userEvent.setup();
    render(<ReassignTaskModal {...defaultProps} />);

    await user.selectOptions(screen.getByRole('combobox'), 'inv-1');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Workload balance');

    const btn = screen.getByRole('button', { name: /Confirm Reassignment/i });
    expect(btn).toBeEnabled();
  });

  it('calls onReassign and onClose on submit', async () => {
    const user = userEvent.setup();
    render(<ReassignTaskModal {...defaultProps} />);

    await user.selectOptions(screen.getByRole('combobox'), 'inv-1');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Workload balance');
    await user.click(screen.getByRole('button', { name: /Confirm Reassignment/i }));

    await waitFor(() => {
      expect(defaultProps.onReassign).toHaveBeenCalledWith(baseTask, 'inv-1', 'Workload balance');
    });
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows Reassigning... text and overlay while submitting', async () => {
    const user = userEvent.setup();
    let resolveReassign!: () => void;
    const reassignPromise = new Promise<void>((r) => { resolveReassign = r; });
    const onReassign = vi.fn(() => reassignPromise);

    render(<ReassignTaskModal {...defaultProps} onReassign={onReassign} />);

    await user.selectOptions(screen.getByRole('combobox'), 'inv-1');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');
    await user.click(screen.getByRole('button', { name: /Confirm Reassignment/i }));

    expect(screen.getByText('Reassigning...')).toBeInTheDocument();
    expect(screen.getByText('Reassigning task...')).toBeInTheDocument();

    resolveReassign();
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    render(<ReassignTaskModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('resets fields when reopened', () => {
    const { rerender } = render(<ReassignTaskModal {...defaultProps} />);
    rerender(<ReassignTaskModal {...defaultProps} open={false} />);
    rerender(<ReassignTaskModal {...defaultProps} open={true} />);
    const textarea = screen.getByPlaceholderText(/Provide a reason/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  /* --- SAR task branch --- */

  it('fetches compliance officers for SAR tasks with compliance role', () => {
    mockHasComplianceOfficerRole = vi.fn(() => true);
    mockComplianceOfficers = [];
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<ReassignTaskModal {...defaultProps} task={sarTask} />);
    expect(mockFetchComplianceOfficersList).toHaveBeenCalled();
  });

  it('shows compliance officers dropdown for SAR tasks', () => {
    mockHasComplianceOfficerRole = vi.fn(() => true);
    mockComplianceOfficers = [
      { id: 'co-1', name: 'co1', firstName: 'Alice', lastName: 'Wonder' },
    ];
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<ReassignTaskModal {...defaultProps} task={sarTask} />);
    expect(screen.getByText(/Alice Wonder/)).toBeInTheDocument();
    expect(screen.getByText(/Select Compliance Officer/i)).toBeInTheDocument();
  });

  it('shows no compliance officers message when empty for SAR tasks', () => {
    mockComplianceOfficers = [];
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<ReassignTaskModal {...defaultProps} task={sarTask} />);
    expect(screen.getByText(/No other compliance officers available/i)).toBeInTheDocument();
  });

  /* --- getAssigneeFullName branches --- */

  it('shows supervisor name when assignee found in supervisors', () => {
    mockSupervisors = [
      { id: 'inv-old', name: 'sup_old', firstName: 'Sup', lastName: 'Visor' },
    ];
    render(<ReassignTaskModal {...defaultProps} />);
    expect(screen.getByText(/Sup Visor/)).toBeInTheDocument();
  });

  it('falls back to assigneeName when not found in any list', () => {
    mockInvestigators = [];
    mockComplianceOfficers = [];
    mockSupervisors = [];
    render(<ReassignTaskModal {...defaultProps} />);
    // Falls back to assigneeName ?? assignee
    expect(screen.getByText(/Old Assignee/)).toBeInTheDocument();
  });

  /* --- Error handling --- */

  it('handles reassign failure gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReassign = vi.fn().mockRejectedValue(new Error('fail'));

    render(<ReassignTaskModal {...defaultProps} onReassign={onReassign} />);
    await user.selectOptions(screen.getByRole('combobox'), 'inv-1');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');
    await user.click(screen.getByRole('button', { name: /Confirm Reassignment/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to reassign task:', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('fetches investigators list for non-SAR tasks', () => {
    render(<ReassignTaskModal {...defaultProps} />);
    expect(mockFetchInvestigatorsList).toHaveBeenCalled();
  });

  it('skips compliance officers fetch when already loaded', () => {
    mockHasComplianceOfficerRole = vi.fn(() => true);
    mockComplianceOfficers = [
      { id: 'co-1', name: 'co1', firstName: 'Alice', lastName: 'Wonder' },
    ];
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<ReassignTaskModal {...defaultProps} task={sarTask} />);
    expect(mockFetchComplianceOfficersList).not.toHaveBeenCalled();
  });

  it('shows assignee from assignee field when only assignee is present', () => {
    const taskOnlyAssignee = { ...baseTask, assigneeName: undefined, assignee: 'some-id' };
    render(<ReassignTaskModal {...defaultProps} task={taskOnlyAssignee} />);
    expect(screen.getByText('some-id')).toBeInTheDocument();
  });
});
