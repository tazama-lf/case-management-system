import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UnassignTaskModal from '../UnassignTaskModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';

const mockTask: UnifiedWorkQueueTask = {
  id: 'TASK-123',
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 'CASE-123',
  assignee: 'inv-1',
  assigneeName: 'John Doe',
  created: '2024-01-01T00:00:00Z',
  dueDate: null,
  description: 'Review suspicious transaction',
};

describe('UnassignTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnUnassign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <UnassignTaskModal
        open={false}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={mockTask}
      />,
    );
    expect(screen.queryByText('Unassign Task')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <UnassignTaskModal
        open={true}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={null}
      />,
    );
    expect(screen.queryByText('Unassign Task')).not.toBeInTheDocument();
  });

  it('renders modal with task information when open', () => {
    render(
      <UnassignTaskModal
        open={true}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={mockTask}
      />,
    );

    expect(screen.getByRole('heading', { name: /Unassign Task/i })).toBeInTheDocument();
    expect(screen.getByText(/Task ID: TASK-123/i)).toBeInTheDocument();
    expect(screen.getByText(/Review Transaction/i)).toBeInTheDocument();
  });

  it('disables submit button when reason is empty', () => {
    render(
      <UnassignTaskModal
        open={true}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={mockTask}
      />,
    );

    const submitButton = screen.getByRole('button', { name: /Unassign Task/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when reason is provided', async () => {
    const user = userEvent.setup();
    render(
      <UnassignTaskModal
        open={true}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={mockTask}
      />,
    );

    const reasonTextarea = screen.getByPlaceholderText(/Explain why this task is being unassigned/i);
    const submitButton = screen.getByRole('button', { name: /Unassign Task/i });

    await user.type(reasonTextarea, 'Workload redistribution');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with reason', async () => {
    const user = userEvent.setup();
    mockOnUnassign.mockResolvedValue(undefined);

    render(
      <UnassignTaskModal
        open={true}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={mockTask}
      />,
    );

    const reasonTextarea = screen.getByPlaceholderText(/Explain why this task is being unassigned/i);
    const submitButton = screen.getByRole('button', { name: /Unassign Task/i });

    await user.type(reasonTextarea, 'Workload redistribution');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnUnassign).toHaveBeenCalledWith(
        'TASK-123',
        'Workload redistribution',
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <UnassignTaskModal
        open={true}
        onClose={mockOnClose}
        onUnassign={mockOnUnassign}
        task={mockTask}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

