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

  it('does not render when closed', () => {
    render(
      <ReassignTaskModal open={false} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );
    expect(screen.queryByText(/Reassign Task/i)).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={null} />
    );
    expect(screen.queryByText(/Reassign Task/i)).not.toBeInTheDocument();
  });

  it('renders modal with task info', () => {
    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    expect(screen.getByText(/Reassign Task/i)).toBeInTheDocument();
    expect(screen.getByText('TASK-123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
  });

  it('shows current assignee formatted correctly', () => {
    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    expect(
      screen.getByText(/John Doe \(inv-1\)/)
    ).toBeInTheDocument();
  });

  it('shows Unassigned when no assignee', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={{ ...mockTask, assignee: undefined as any, assigneeName: undefined as any }}
      />
    );

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('fetches investigators on open', async () => {
    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    await waitFor(() => {
      expect(mockFetchInvestigatorsList).toHaveBeenCalledTimes(1);
    });
  });

  it('fetches compliance officers for SAR when allowed', async () => {
    mockHasComplianceOfficerRole = true;

    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockSarTask} />
    );

    await waitFor(() => {
      expect(mockFetchComplianceOfficersList).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state', () => {
    mockLoadingInvestigators = true;

    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    expect(screen.getByText(/Loading investigators/i)).toBeInTheDocument();
  });

  it('filters dropdown options correctly', () => {
    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));

    // must always have placeholder
    expect(options[0].textContent).toContain('Select');

    // should NOT include current assignee
    expect(options.some(o => o.value === 'inv-1')).toBe(false);

    // inv-2 should be available (based on your mock)
    expect(options.some(o => o.value === 'inv-2')).toBe(true);
  });

  it('shows "Me" option when user can assign to self', () => {
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'inv-2',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
    });

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));

    expect(
      options.some(o => o.textContent?.includes('(Me)'))
    ).toBe(true);
  });

  it('does not show Me option when user is already the assignee', () => {
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'inv-1', // same as task assignee
    });

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));

    expect(
      options.some(o => o.textContent?.includes('(Me)'))
    ).toBe(false);
  });

  it('shows empty state when no other investigators available and user cannot self-assign', () => {
    mockInvestigators = [
      { id: 'inv-1', firstName: 'John', lastName: 'Doe', name: 'jdoe' },
    ];

    // force same user as assignee → disables "Me"
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'inv-1',
    });

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    expect(
      screen.getByText(/No other investigators available/i)
    ).toBeInTheDocument();
  });

  it('submits form correctly', async () => {
    const user = userEvent.setup();
    mockOnReassign.mockResolvedValue(undefined);

    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Workload redistribution');

    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    await waitFor(() => {
      expect(mockOnReassign).toHaveBeenCalledWith(
        mockTask,
        'inv-2',
        'Workload redistribution'
      );
    });
  });

  it('prevents double submission when already submitting', async () => {
    const user = userEvent.setup();

    let resolveFn: any;

    mockOnReassign.mockImplementation(
      () => new Promise(res => (resolveFn = res))
    );

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');

    await user.click(screen.getByRole('button', { name: /Reassign/i }));
    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    expect(mockOnReassign).toHaveBeenCalledTimes(1);

    resolveFn();
  });

  it('does not submit when justification is empty', async () => {
    const user = userEvent.setup();

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');

    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    expect(mockOnReassign).not.toHaveBeenCalled();
  });

  it('does not submit when assignee is empty', async () => {
    const user = userEvent.setup();

    render(
      <ReassignTaskModal
        open={true}
        onClose={mockOnClose}
        onReassign={mockOnReassign}
        task={mockTask}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/Provide a reason/i),
      'Valid reason'
    );

    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    expect(mockOnReassign).not.toHaveBeenCalled();
  });

  it('calls onClose after success', async () => {
    const user = userEvent.setup();
    mockOnReassign.mockResolvedValue(undefined);

    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');
    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles error gracefully', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockOnReassign.mockRejectedValue(new Error('fail'));

    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'inv-2');
    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'Reason');
    await user.click(screen.getByRole('button', { name: /Reassign/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    spy.mockRestore();
  });

  it('disables submit when invalid', () => {
    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    expect(
      screen.getByRole('button', { name: /Confirm Reassignment/i })
    ).toBeDisabled();
  });

  it('closes on cancel', async () => {
    const user = userEvent.setup();

    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('resets form on reopen', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    await user.type(screen.getByPlaceholderText(/Provide a reason/i), 'test');

    rerender(<ReassignTaskModal open={false} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />);
    rerender(<ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />);

    expect(screen.getByPlaceholderText(/Provide a reason/i)).toHaveValue('');
  });

  it('shows audit text', () => {
    render(
      <ReassignTaskModal open={true} onClose={mockOnClose} onReassign={mockOnReassign} task={mockTask} />
    );

    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });
});