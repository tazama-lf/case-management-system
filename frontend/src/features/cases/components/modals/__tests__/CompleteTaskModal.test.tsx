import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CompleteTaskModal from '../CompleteTaskModal';
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

describe('CompleteTaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  it('does not render when open is false', () => {
    render(
      <CompleteTaskModal
        open={false}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        task={mockTask}
      />,
    );
    expect(screen.queryByText(/Complete Task/i)).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <CompleteTaskModal
        open={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        task={mockTask}
      />,
    );

    expect(screen.getByRole('heading', { name: /Complete Task/i })).toBeInTheDocument();
  });
});

