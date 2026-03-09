import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UpdateTaskStatusModal from '../UpdateTaskStatusModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';

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

describe('UpdateTaskStatusModal', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdateStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <UpdateTaskStatusModal
        open={false}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={mockTask}
      />,
    );
    expect(screen.queryByText('Update Task Status')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <UpdateTaskStatusModal
        open={true}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={null}
      />,
    );
    expect(screen.queryByText('Update Task Status')).not.toBeInTheDocument();
  });

  it('renders modal with task information when open', () => {
    render(
      <UpdateTaskStatusModal
        open={true}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={mockTask}
      />,
    );

    expect(screen.getByText('Update Task Status')).toBeInTheDocument();
    expect(screen.getByText('TASK-123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
  });

  it('disables submit button when no status is selected', () => {
    render(
      <UpdateTaskStatusModal
        open={true}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={mockTask}
      />,
    );

    const submitButton = screen.getByRole('button', { name: /Update Status/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when different status is selected', async () => {
    const user = userEvent.setup();
    render(
      <UpdateTaskStatusModal
        open={true}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={mockTask}
      />,
    );

    const statusSelect = screen.getByRole('combobox');
    await user.selectOptions(statusSelect, 'In Progress');

    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: /Update Status/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with new status', async () => {
    const user = userEvent.setup();
    render(
      <UpdateTaskStatusModal
        open={true}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={mockTask}
      />,
    );

    const statusSelect = screen.getByRole('combobox');
    await user.selectOptions(statusSelect, 'In Progress');

    const submitButton = screen.getByRole('button', { name: /Update Status/i });
    await user.click(submitButton);

    // UpdateTaskStatusModal doesn't have a notes field, so notes will be undefined
    expect(mockOnUpdateStatus).toHaveBeenCalledWith(
      mockTask,
      'In Progress',
      undefined,
    );
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <UpdateTaskStatusModal
        open={true}
        onClose={mockOnClose}
        onUpdateStatus={mockOnUpdateStatus}
        task={mockTask}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
