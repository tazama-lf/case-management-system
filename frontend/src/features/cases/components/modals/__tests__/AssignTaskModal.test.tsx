import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AssignTaskModal from '../AssignTaskModal';
import type { UnifiedWorkQueueTask } from '../../../types/task.types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockFetchInvestigatorsList = vi.fn();
const mockFetchComplianceOfficersList = vi.fn();
let mockLoadingInvestigators = false;
let mockInvestigators: Array<{ id: string; name: string; firstName: string; lastName: string }> = [];
let mockComplianceOfficers: Array<{ id: string; name: string; firstName: string; lastName: string }> = [];

vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    fetchInvestigatorsList: mockFetchInvestigatorsList,
    loadingInvestigators: mockLoadingInvestigators,
    investigators: mockInvestigators,
    fetchComplianceOfficersList: mockFetchComplianceOfficersList,
    complianceOfficers: mockComplianceOfficers,
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
  status: 'STATUS_01_UNASSIGNED',
  caseId: 100,
  assignee: undefined,
  created: '2024-01-01T00:00:00Z',
  description: 'Review suspicious transaction',
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onAssign: vi.fn().mockResolvedValue(undefined),
  task: baseTask,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AssignTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadingInvestigators = false;
    mockInvestigators = [
      { id: 'inv-1', name: 'inv1', firstName: 'John', lastName: 'Doe' },
      { id: 'inv-2', name: 'inv2', firstName: 'Jane', lastName: 'Smith' },
    ];
    mockComplianceOfficers = [];
    mockHasComplianceOfficerRole = vi.fn(() => false);
    mockGetUser.mockReturnValue({
      userId: 'user-1',
      fullName: 'Current User',
      email: 'user@test.com',
      validatedClaims: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* --- Visibility --- */

  it('does not render when open is false', () => {
    render(<AssignTaskModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Assign Task')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(<AssignTaskModal {...defaultProps} task={null} />);
    expect(screen.queryByText('Assign Task')).not.toBeInTheDocument();
  });

  it('does not render when task is undefined', () => {
    render(<AssignTaskModal {...defaultProps} task={undefined} />);
    expect(screen.queryByText('Assign Task')).not.toBeInTheDocument();
  });

  /* --- Rendering --- */

  it('renders modal heading and task info when open', () => {
    render(<AssignTaskModal {...defaultProps} />);
    // 'Assign Task' appears in heading and button
    expect(screen.getAllByText('Assign Task').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    expect(screen.getByText('STATUS_01_UNASSIGNED')).toBeInTheDocument();
  });

  it('renders assignee select with current user option', () => {
    render(<AssignTaskModal {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Current User (Me)')).toBeInTheDocument();
  });

  it('shows loading state when fetching investigators', () => {
    mockLoadingInvestigators = true;
    render(<AssignTaskModal {...defaultProps} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders investigators list when user is supervisor', () => {
    mockGetUser.mockReturnValue({
      userId: 'user-1',
      fullName: 'Current User',
      email: 'user@test.com',
      validatedClaims: { CMS_SUPERVISOR: true },
    });
    render(<AssignTaskModal {...defaultProps} />);
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('renders notes textarea', () => {
    render(<AssignTaskModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Add any assignment notes/i)).toBeInTheDocument();
  });

  /* --- Interactions --- */

  it('disables assign button when no assignee selected', () => {
    render(<AssignTaskModal {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /Assign Task/i });
    expect(btn).toBeDisabled();
  });

  it('enables assign button when assignee selected', async () => {
    const user = userEvent.setup();
    render(<AssignTaskModal {...defaultProps} />);
    await user.selectOptions(screen.getByRole('combobox'), 'user-1');
    const btn = screen.getByRole('button', { name: /Assign Task/i });
    expect(btn).toBeEnabled();
  });

  it('calls onAssign with task, assignee, and notes on submit', async () => {
    const user = userEvent.setup();
    render(<AssignTaskModal {...defaultProps} />);

    await user.selectOptions(screen.getByRole('combobox'), 'user-1');
    await user.type(screen.getByPlaceholderText(/Add any assignment notes/i), 'Test notes');
    await user.click(screen.getByRole('button', { name: /Assign Task/i }));

    await waitFor(() => {
      expect(defaultProps.onAssign).toHaveBeenCalledWith(baseTask, 'user-1', 'Test notes');
    });
  });

  it('shows Assigning... text while submitting', async () => {
    const user = userEvent.setup();
    let resolveAssign!: () => void;
    const assignPromise = new Promise<void>((r) => { resolveAssign = r; });
    const onAssign = vi.fn(() => assignPromise);

    render(<AssignTaskModal {...defaultProps} onAssign={onAssign} />);

    await user.selectOptions(screen.getByRole('combobox'), 'user-1');
    await user.click(screen.getByRole('button', { name: /Assign Task/i }));

    expect(screen.getByText('Assigning...')).toBeInTheDocument();
    resolveAssign();
    await waitFor(() => {
      expect(screen.queryByText('Assigning...')).not.toBeInTheDocument();
    });
  });

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    render(<AssignTaskModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('resets fields when reopened', () => {
    const { rerender } = render(<AssignTaskModal {...defaultProps} />);
    rerender(<AssignTaskModal {...defaultProps} open={false} />);
    rerender(<AssignTaskModal {...defaultProps} open={true} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  /* --- SAR task branch --- */

  it('fetches compliance officers for SAR tasks when user has compliance role', () => {
    mockHasComplianceOfficerRole = vi.fn(() => true);
    mockComplianceOfficers = [];
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<AssignTaskModal {...defaultProps} task={sarTask} />);
    expect(mockFetchComplianceOfficersList).toHaveBeenCalled();
  });

  it('fetches investigators for non-SAR tasks when user is supervisor', () => {
    mockGetUser.mockReturnValue({
      userId: 'user-1',
      fullName: 'Current User',
      email: 'user@test.com',
      validatedClaims: { CMS_SUPERVISOR: true },
    });
    render(<AssignTaskModal {...defaultProps} />);
    expect(mockFetchInvestigatorsList).toHaveBeenCalled();
  });

  /* --- Error handling --- */

  it('handles assign failure gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onAssign = vi.fn().mockRejectedValue(new Error('fail'));

    render(<AssignTaskModal {...defaultProps} onAssign={onAssign} />);
    await user.selectOptions(screen.getByRole('combobox'), 'user-1');
    await user.click(screen.getByRole('button', { name: /Assign Task/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to assign task:', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('handles missing user gracefully in fetchCurrentUserAsInvestigator', () => {
    mockGetUser.mockReturnValue(null);
    render(<AssignTaskModal {...defaultProps} />);
    expect(screen.queryByText(/\(Me\)/)).not.toBeInTheDocument();
  });

  it('handles error in fetchCurrentUserAsInvestigator', () => {
    // getUser is called twice in the useEffect: once at the top and once inside
    // fetchCurrentUserAsInvestigator. The first call is not in a try/catch,
    // so we make the first call return null and the second throw.
    let callCount = 0;
    mockGetUser.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return null; // first call in useEffect
      throw new Error('auth error'); // second call in fetchCurrentUserAsInvestigator
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AssignTaskModal {...defaultProps} />);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch current user:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('skips compliance officer fetch for SAR when already loaded', () => {
    mockHasComplianceOfficerRole = vi.fn(() => true);
    mockComplianceOfficers = [
      { id: 'co-1', name: 'co1', firstName: 'Alice', lastName: 'Wonder' },
    ];
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<AssignTaskModal {...defaultProps} task={sarTask} />);
    expect(mockFetchComplianceOfficersList).not.toHaveBeenCalled();
  });

  it('does not fetch compliance officers for SAR if user lacks role', () => {
    mockHasComplianceOfficerRole = vi.fn(() => false);
    const sarTask = { ...baseTask, name: 'File SAR Report' };
    render(<AssignTaskModal {...defaultProps} task={sarTask} />);
    expect(mockFetchComplianceOfficersList).not.toHaveBeenCalled();
  });
});
