import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { UnifiedWorkQueueTask } from '../../types/flowable.types';
import WorkQueueTable from '../WorkQueueTable';

vi.mock('../../../../shared/utils/dateUtils', () => ({
  formatDate: vi.fn(() => 'Formatted Date'),
}));

const buildTask = (overrides: Partial<UnifiedWorkQueueTask> = {}) =>
  ({
    id: 'task-1',
    taskId: 'task-1',
    name: 'Investigate alert',
    status: 'UNASSIGNED',
    priority: 'NEW',
    createdAt: '2024-01-01T00:00:00.000Z',
    processInstanceId: 'proc-1',
    caseId: 'CASE-1',
    ...overrides,
  }) as UnifiedWorkQueueTask;

describe('WorkQueueTable', () => {
  it('renders task details and formatted date', () => {
    render(
      <WorkQueueTable
        tasks={[
          buildTask({
            status: 'ASSIGNED',
            assignee: 'user-1',
            assigneeName: 'Sam Investigator',
            candidateGroup: 'Investigations',
          }),
        ]}
        onAssign={vi.fn()}
      />,
    );

    expect(screen.getByText('task-1')).toBeInTheDocument();
    expect(screen.getByText('CASE-1')).toBeInTheDocument();
    expect(screen.getByText('Sam Investigator')).toBeInTheDocument();
    expect(screen.getByText('Formatted Date')).toBeInTheDocument();
    expect(screen.getByText(/Investigations/i)).toBeInTheDocument();
  });

  it('calls onAssign when Assign button is clicked for an unassigned task', () => {
    const onAssign = vi.fn();
    render(<WorkQueueTable tasks={[buildTask()]} onAssign={onAssign} />);

    fireEvent.click(screen.getByRole('button', { name: /Assign/i }));

    expect(onAssign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
    );
  });

  it('renders action buttons for assigned tasks when handlers are provided', () => {
    render(
      <WorkQueueTable
        tasks={[
          buildTask({
            status: 'ASSIGNED',
            assignee: 'user-1',
          }),
        ]}
        onAssign={vi.fn()}
        onReassign={vi.fn()}
        onUnassign={vi.fn()}
        onUpdateStatus={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Reassign/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unassign/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
  });

  it('renders complete action for in-progress tasks and calls handler', () => {
    const onComplete = vi.fn();
    render(
      <WorkQueueTable
        tasks={[
          buildTask({
            status: 'IN_PROGRESS',
            assignee: 'user-1',
          }),
        ]}
        onAssign={vi.fn()}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'IN_PROGRESS' }),
    );
  });

  it('shows empty state when there are no tasks', () => {
    render(<WorkQueueTable tasks={[]} onAssign={vi.fn()} />);

    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No tasks are currently available in this work queue',
      ),
    ).toBeInTheDocument();
  });

  it('renders pagination controls and calls onPageChange', () => {
    const onPageChange = vi.fn();
    render(
      <WorkQueueTable
        tasks={[buildTask()]}
        onAssign={vi.fn()}
        pagination={{
          currentPage: 1,
          pageSize: 5,
          totalItems: 10,
          totalPages: 2,
          onPageChange,
        }}
      />,
    );

    const paginationRegion = screen.getByRole('navigation', {
      name: /Pagination/i,
    });
    expect(
      within(paginationRegion).getByRole('button', { name: '1' }),
    ).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('builds pagination window with ellipsis when many pages exist', () => {
    render(
      <WorkQueueTable
        tasks={[buildTask()]}
        onAssign={vi.fn()}
        pagination={{
          currentPage: 5,
          pageSize: 5,
          totalItems: 100,
          totalPages: 20,
          onPageChange: vi.fn(),
        }}
      />,
    );

    const paginationRegion = screen.getByRole('navigation', {
      name: /Pagination/i,
    });
    expect(within(paginationRegion).getAllByText('…').length).toBeGreaterThan(0);
    expect(
      within(paginationRegion).getByRole('button', { name: '1' }),
    ).toBeInTheDocument();
    expect(
      within(paginationRegion).getByRole('button', { name: '20' }),
    ).toBeInTheDocument();
  });

  it('falls back to default status badge label when status is unknown', () => {
    render(
      <WorkQueueTable
        tasks={[
          buildTask({
            status: 'UNKNOWN' as any,
          }),
        ]}
        onAssign={vi.fn()}
      />,
    );

    const statusBadges = screen.getAllByText('Unassigned');
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('hides actions for completed tasks', () => {
    render(
      <WorkQueueTable
        tasks={[
          buildTask({
            status: 'COMPLETED',
            assignee: 'user-1',
          }),
        ]}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onReassign={vi.fn()}
        onUpdateStatus={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Assign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reassign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Unassign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete/i })).not.toBeInTheDocument();
  });
});

