import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkQueuesTable from '../WorkQueuesTable';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../EditWorkQueueForm', () => ({
  __esModule: true,
  default: ({ queue, onSave, onCancel }: any) => (
    <div data-testid="edit-form">
      <p>{queue?.name}</p>
      <button onClick={() => onSave(queue)}>save</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

const baseQueue = {
  id: 'queue-1',
  name: 'Investigations',
  description: 'Handles AML alerts',
  roles: ['Analyst'],
  taskTypes: ['Review'],
  status: 'Active',
  taskCount: 12,
};

const roleColors = { Analyst: 'bg-blue-100 text-blue-800' };
const taskTypeColors = { Review: 'bg-green-100 text-green-800' };

describe('WorkQueuesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders queue information with colored badges', () => {
    render(
      <WorkQueuesTable
        queues={[baseQueue]}
        roleColors={roleColors}
        taskTypeColors={taskTypeColors}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Investigations')).toBeInTheDocument();
    expect(screen.getByText('Handles AML alerts')).toBeInTheDocument();
    expect(screen.getByText('Analyst').className).toContain('bg-blue-100');
    expect(screen.getByText('Review').className).toContain('bg-green-100');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('opens the edit modal and calls onEdit when the embedded form saves', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <WorkQueuesTable
        queues={[baseQueue]}
        roleColors={roleColors}
        taskTypeColors={taskTypeColors}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /edit investigations/i }),
    );
    expect(screen.getByTestId('edit-form')).toBeInTheDocument();

    await user.click(screen.getByText('save'));
    expect(onEdit).toHaveBeenCalledWith(baseQueue);
  });

  it('confirms deletion before calling onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <WorkQueuesTable
        queues={[baseQueue]}
        roleColors={roleColors}
        taskTypeColors={taskTypeColors}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /delete investigations/i }),
    );
    expect(
      screen.getByRole('heading', { name: /delete work queue/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('queue-1');
  });

  it('shows an empty state when no queues exist', () => {
    render(
      <WorkQueuesTable
        queues={[]}
        roleColors={{}}
        taskTypeColors={{}}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/No work queues found matching your search criteria/i),
    ).toBeInTheDocument();
  });
});
