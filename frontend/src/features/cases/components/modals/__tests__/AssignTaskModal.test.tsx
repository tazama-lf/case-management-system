import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssignTaskModal from '../AssignTaskModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';
import authService from '../../../../auth/services/authService';

vi.mock('../../../../auth/services/authService');
vi.mock('../../../../cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    fetchInvestigatorsList: vi.fn(),
    loadingInvestigators: false,
    investigators: [
      { value: 'inv-1', label: 'John Doe' },
      { value: 'inv-2', label: 'Jane Smith' },
    ],
    fetchComplianceOfficersList: vi.fn(),
    complianceOfficers: [],
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
  status: 'STATUS_01_UNASSIGNED',
  caseId: 'CASE-123',
  assignee: null,
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

describe('AssignTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAssign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue(
      mockInvestigators,
    );
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'user-1',
      fullName: 'Current User',
      email: 'user@test.com',
    });
  });

  it('does not render when open is false', () => {
    render(
      <AssignTaskModal
        open={false}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={mockTask}
      />,
    );
    expect(screen.queryByText('Assign Task')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <AssignTaskModal
        open={true}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={null}
      />,
    );
    expect(screen.queryByText('Assign Task')).not.toBeInTheDocument();
  });

  it('renders modal with task information when open', async () => {
    render(
      <AssignTaskModal
        open={true}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={mockTask}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Assign Task/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('TASK-123')).toBeInTheDocument();
  });

  it('fetches investigators when modal opens', async () => {
    render(
      <AssignTaskModal
        open={true}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(authService.fetchAllInvestigators).toHaveBeenCalled();
    });
  });

  it('disables submit button when no assignee is selected', () => {
    render(
      <AssignTaskModal
        open={true}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={mockTask}
      />,
    );

    const submitButton = screen.getByRole('button', { name: /Assign/i });
    expect(submitButton).toBeDisabled();
  });

  it('submits form with assignee and notes', async () => {
    const user = userEvent.setup();
    mockOnAssign.mockResolvedValue(undefined);

    render(
      <AssignTaskModal
        open={true}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      // The select might not have a label association, find it by its position or text
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    // Find the assignee select - it should be the one with "Select Investigator" option
    const assigneeSelect = screen.getByRole('combobox');
    await user.selectOptions(assigneeSelect, 'inv-1');

    const notesTextarea = screen.getByPlaceholderText(
      /Add any assignment notes/i,
    );
    await user.type(notesTextarea, 'Assigned for review');

    const submitButton = screen.getByRole('button', { name: /Assign/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnAssign).toHaveBeenCalledWith(
        mockTask,
        'inv-1',
        'Assigned for review',
      );
    });
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AssignTaskModal
        open={true}
        onClose={mockOnClose}
        onAssign={mockOnAssign}
        task={mockTask}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
