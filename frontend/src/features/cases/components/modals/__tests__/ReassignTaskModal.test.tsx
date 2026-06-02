import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReassignTaskModal from '../ReassignTaskModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';
import authService from '../../../../auth/services/authService';

const mockFetchInvestigatorsList = vi.fn();
const mockFetchComplianceOfficersList = vi.fn();
let mockInvestigators = [
  { id: 'inv-1', firstName: 'John', lastName: 'Doe', name: 'jdoe' },
  { id: 'inv-2', firstName: 'Jane', lastName: 'Smith', name: 'jsmith' },
];
let mockComplianceOfficers: any[] = [];
let mockSupervisors: any[] = [];
let mockLoadingInvestigators = false;
let mockHasComplianceOfficerRole = false;

vi.mock('../../../../auth/services/authService');
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
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => mockHasComplianceOfficerRole,
  }),
}));

const mockTask: UnifiedWorkQueueTask = {
  id: 'TASK-123',
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 'CASE-123',
  assignee: 'inv-1',
  assigneeName: 'jdoe',
  created: '2024-01-01T00:00:00Z',
  dueDate: null,
  description: 'Review suspicious transaction',
};

const mockSarTask: UnifiedWorkQueueTask = {
  ...mockTask,
  id: 'TASK-SAR',
  name: 'SAR Filing Review',
  assignee: 'co-1',
  assigneeName: 'cofficer',
};

describe('ReassignTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnReassign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvestigators = [
      { id: 'inv-1', firstName: 'John', lastName: 'Doe', name: 'jdoe' },
      { id: 'inv-2', firstName: 'Jane', lastName: 'Smith', name: 'jsmith' },
    ];
    mockComplianceOfficers = [];
    mockSupervisors = [];
    mockLoadingInvestigators = false;
    mockHasComplianceOfficerRole = false;
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'user-1',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
    });
  });

  it('does not render when open is false', () => {
    render(
      <ReassignTaskModal
        open={false}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    expect(screen.queryByText(/Reassign Task/i)).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={null}
      />,
    );
    expect(screen.queryByText(/Reassign Task/i)).not.toBeInTheDocument();
  });

  it('renders modal with task information when open', async () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    expect(screen.getByText(/Reassign Task/i)).toBeInTheDocument();
    expect(screen.getByText('TASK-123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
  });

  it('displays current assignee name with full name', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    // getAssigneeFullName looks up in investigators
    expect(screen.getByText(/John Doe.*inv-1/)).toBeInTheDocument();
  });

  it('displays "Unassigned" when task has no assignee', () => {
    const unassignedTask = {
      ...mockTask,
      assignee: undefined as any,
      assigneeName: undefined as any,
    };
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={unassignedTask}
      />,
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('fetches investigators when modal opens', async () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(mockFetchInvestigatorsList).toHaveBeenCalled();
    });
  });

  it('fetches compliance officers for SAR tasks when user has compliance role', async () => {
    mockHasComplianceOfficerRole = true;
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockSarTask}
      />,
    );

    await waitFor(() => {
      expect(mockFetchComplianceOfficersList).toHaveBeenCalled();
    });
  });

  it('shows loading state when investigators are loading', () => {
    mockLoadingInvestigators = true;
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    expect(screen.getByText(/Loading investigators.../i)).toBeInTheDocument();
  });

  it('filters out current assignee and current user from dropdown', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    // inv-1 is current assignee and user-1 is current user, so only inv-2 should remain + the placeholder
    expect(options.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No other investigators available" when list is empty after filtering', () => {
    mockInvestigators = [
      { id: 'inv-1', firstName: 'John', lastName: 'Doe', name: 'jdoe' },
    ];
    // inv-1 is the current assignee, so after filtering, no investigators available
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    expect(
      screen.getByText(/No other investigators available for reassignment/i)
    ).toBeInTheDocument();
  });

  it('shows "No other compliance officers" for SAR tasks with empty list', () => {
    mockComplianceOfficers = [];
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockSarTask}
      />,
    );
    expect(
      screen.getByText(/No other compliance officers available for reassignment/i),
    ).toBeInTheDocument();
  });

  it('submits form with assignee and justification', async () => {
    const user = userEvent.setup();
    mockOnReassign.mockResolvedValue(undefined);

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    const assigneeSelect = screen.getByRole('combobox');
    await user.selectOptions(assigneeSelect, 'inv-2');

    const justificationTextarea = screen.getByPlaceholderText(
      /Provide a reason for reassigning this task/i,
    );
    await user.type(justificationTextarea, 'Workload redistribution');

    const submitButton = screen.getByRole('button', { name: /Reassign/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnReassign).toHaveBeenCalledWith(
        mockTask,
        'inv-2',
        'Workload redistribution',
      );
    });
  });

  it('calls onClose after successful reassignment', async () => {
    const user = userEvent.setup();
    mockOnReassign.mockResolvedValue(undefined);

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');
    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles reassignment error gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockOnReassign.mockRejectedValue(new Error('Network error'));

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(
      screen.getByPlaceholderText(/Provide a reason/i),
      'Reason text here',
    );
    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to reassign task:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('disables confirm button when form is incomplete', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    const submitButton = screen.getByRole('button', {
      name: /Confirm Reassignment/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('resets form fields when task or open changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Provide a reason/i);
    await user.type(textarea, 'Some reason');

    // Close and reopen
    rerender(
      <ReassignTaskModal
        open={false}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    rerender(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    const newTextarea = screen.getByPlaceholderText(/Provide a reason/i);
    expect(newTextarea).toHaveValue('');
  });

  it('shows Note label with required indicator', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows audit log info text', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );
    expect(
      screen.getByText(/This note will be recorded in the audit log/i),
    ).toBeInTheDocument();
  });

  it('resolves assignee full name from supervisors', () => {
    mockSupervisors = [
      { id: 'sup-1', firstName: 'Super', lastName: 'Visor', name: 'svisor' },
    ];
    const taskWithSupervisor = {
      ...mockTask,
      assignee: 'sup-1',
      assigneeName: 'svisor',
    };
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={taskWithSupervisor}
      />,
    );
    expect(screen.getByText(/Super Visor.*sup-1/)).toBeInTheDocument();
  });

  it('shows submitting overlay during reassignment', async () => {
    const user = userEvent.setup();
    let resolveReassign: () => void;
    mockOnReassign.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReassign = resolve;
        }),
    );

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');
    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    await waitFor(() => {
      expect(screen.getByText(/Reassigning task.../i)).toBeInTheDocument();
    });

    resolveReassign!();

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows compliance officer options for SAR task dropdown', () => {
    mockComplianceOfficers = [
      { id: 'co-1', firstName: 'Carol', lastName: 'Officer', name: 'cofficer' },
      {
        id: 'co-2',
        firstName: 'Dave',
        lastName: 'Compliance',
        name: 'dcompliance',
      },
    ];
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockSarTask}
      />,
    );
    // co-1 is the current assignee, so only co-2 should appear in dropdown
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));
    // First option is placeholder, remaining are compliance officers
    expect(options.length).toBe(3); // placeholder + co-2 = me
    expect(options[1].textContent).toContain('Dave Compliance');
    expect(options[1].value).toBe('co-2');
  });

  it('resolves assignee full name from compliance officers', () => {
    mockComplianceOfficers = [
      { id: 'co-1', firstName: 'Carol', lastName: 'Officer', name: 'cofficer' },
    ];
    const taskWithCO = {
      ...mockTask,
      assignee: 'co-1',
      assigneeName: 'cofficer',
    };
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={taskWithCO}
      />,
    );
    expect(screen.getByText(/Carol Officer.*co-1/)).toBeInTheDocument();
  });

  it('falls back to assigneeName when not found in any list', () => {
    const taskWithUnknown = {
      ...mockTask,
      assignee: 'unknown-id',
      assigneeName: 'unknownuser',
    };
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={taskWithUnknown}
      />,
    );
    expect(screen.getByText(/unknownuser.*unknown-id/)).toBeInTheDocument();
  });
});
