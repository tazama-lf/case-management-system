import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CloseTaskModal from '../CloseTaskModal';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';

const mockTask: UnifiedWorkQueueTask = {
  id: 'TASK-123',
  name: 'Review Transaction',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 'CASE-123',
  assignee: null,
  created: '2024-01-01T00:00:00Z',
  dueDate: null,
  description: 'Review suspicious transaction',
};

describe('CloseTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCloseTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <CloseTaskModal
        open={false}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={mockTask}
      />,
    );
    expect(screen.queryByText('Close Task')).not.toBeInTheDocument();
  });

  it('does not render when task is null', () => {
    render(
      <CloseTaskModal
        open={true}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={null}
      />,
    );
    expect(screen.queryByText('Close Task')).not.toBeInTheDocument();
  });

  it('renders modal with task information when open', () => {
    render(
      <CloseTaskModal
        open={true}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={mockTask}
      />,
    );

    expect(screen.getByRole('heading', { name: /Close Task/i })).toBeInTheDocument();
    expect(screen.getByText('TASK-123')).toBeInTheDocument();
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
  });

  it('disables submit button when notes are empty', () => {
    render(
      <CloseTaskModal
        open={true}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={mockTask}
      />,
    );

    const submitButton = screen.getByRole('button', { name: /Close Task/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when notes are provided', async () => {
    const user = userEvent.setup();
    render(
      <CloseTaskModal
        open={true}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={mockTask}
      />,
    );

    const notesTextarea = screen.getByPlaceholderText(/Provide details about the task completion/i);
    const submitButton = screen.getByRole('button', { name: /Close Task/i });

    await user.type(notesTextarea, 'Task completed successfully');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with notes', async () => {
    const user = userEvent.setup();
    render(
      <CloseTaskModal
        open={true}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={mockTask}
      />,
    );

    const notesTextarea = screen.getByPlaceholderText(/Provide details about the task completion/i);
    const submitButton = screen.getByRole('button', { name: /Close Task/i });

    await user.type(notesTextarea, 'Task completed');
    await user.click(submitButton);

    expect(mockOnCloseTask).toHaveBeenCalledWith(
      mockTask,
      'Task completed',
    );
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CloseTaskModal
        open={true}
        onClose={mockOnClose}
        onCloseTask={mockOnCloseTask}
        task={mockTask}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

