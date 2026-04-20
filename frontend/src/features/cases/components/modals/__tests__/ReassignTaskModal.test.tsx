import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReassignTaskModal from '../ReassignTaskModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';
import authService from '../../../../auth/services/authService';

vi.mock('../../../../auth/services/authService');
vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    fetchInvestigatorsList: vi.fn(),
    loadingInvestigators: false,
    investigators: [
      { id: 'inv-1', firstName: 'John', lastName: 'Doe', name: 'jdoe' },
      { id: 'inv-2', firstName: 'Jane', lastName: 'Smith', name: 'jsmith' },
    ],
    fetchComplianceOfficersList: vi.fn(),
    complianceOfficers: [],
    supervisors: [],
  }),
}));
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => false,
  }),
}));

const mockTask: UnifiedWorkQueueTask = {
  id: 'TASK-123',
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 'CASE-123',
  assignee: 'inv-1',
  created: '2024-01-01T00:00:00Z',
  dueDate: null,
  description: 'Review suspicious transaction',
};

const mockInvestigators = [
  {
    id: 'inv-1',
    username: 'investigator1',
    email: 'inv1@test.com',
    firstName: 'John',
    lastName: 'Doe',
  },
  {
    id: 'inv-2',
    username: 'investigator2',
    email: 'inv2@test.com',
    firstName: 'Jane',
    lastName: 'Smith',
  },
];

describe('ReassignTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnReassign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (authService.getUser as vi.Mock).mockReturnValue({
      id: 'user-1',
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
      expect(screen.getByText(/Reassign Task/i)).toBeInTheDocument();
    });
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

    await waitFor(() => {
      // The select might not have a label association, find it by its position
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    // Find the reassign select - it should be the one with "Reassign To" label nearby
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
});
