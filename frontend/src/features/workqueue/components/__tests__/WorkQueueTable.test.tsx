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

  describe('Pagination controls', () => {
    it('calls onPageChange when Previous button is clicked', () => {
      const onPageChange = vi.fn();
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 2,
            pageSize: 5,
            totalItems: 10,
            totalPages: 2,
            onPageChange,
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Previous/i }));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('disables Previous button on first page', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 1,
            pageSize: 5,
            totalItems: 10,
            totalPages: 2,
            onPageChange: vi.fn(),
          }}
        />,
      );

      const previousButton = screen.getByRole('button', { name: /Previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('disables Next button on last page', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 2,
            pageSize: 5,
            totalItems: 10,
            totalPages: 2,
            onPageChange: vi.fn(),
          }}
        />,
      );

      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it('calls onPageChange when a page number button is clicked', () => {
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

      fireEvent.click(screen.getByRole('button', { name: '2' }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('prevents going below page 1 when clicking Previous', () => {
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

      const previousButton = screen.getByRole('button', { name: /Previous/i });
      fireEvent.click(previousButton);
      // Should not call onPageChange when disabled, but if it does, should be max(1, 0) = 1
      // Since button is disabled, click should not trigger
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('prevents going above total pages when clicking Next', () => {
      const onPageChange = vi.fn();
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 2,
            pageSize: 5,
            totalItems: 10,
            totalPages: 2,
            onPageChange,
          }}
        />,
      );

      const nextButton = screen.getByRole('button', { name: /Next/i });
      fireEvent.click(nextButton);
      // Should not call onPageChange when disabled
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('shows all pages when totalPages <= windowSize + 2', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 1,
            pageSize: 5,
            totalItems: 35,
            totalPages: 7, // windowSize (5) + 2 = 7, so all pages should show
            onPageChange: vi.fn(),
          }}
        />,
      );

      const paginationRegion = screen.getByRole('navigation', {
        name: /Pagination/i,
      });
      // Should show pages 1-7 without ellipsis
      expect(
        within(paginationRegion).queryByText('…'),
      ).not.toBeInTheDocument();
      for (let i = 1; i <= 7; i++) {
        expect(
          within(paginationRegion).getByRole('button', { name: String(i) }),
        ).toBeInTheDocument();
      }
    });

    it('shows ellipsis at end when currentPage is near start', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 2,
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
      const ellipsis = within(paginationRegion).getAllByText('…');
      // Should have ellipsis at the end
      expect(ellipsis.length).toBeGreaterThan(0);
      expect(
        within(paginationRegion).getByRole('button', { name: '1' }),
      ).toBeInTheDocument();
      expect(
        within(paginationRegion).getByRole('button', { name: '20' }),
      ).toBeInTheDocument();
    });

    it('shows ellipsis on both sides when currentPage is in middle', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 10,
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
      const ellipsis = within(paginationRegion).getAllByText('…');
      // Should have ellipsis on both sides
      expect(ellipsis.length).toBeGreaterThanOrEqual(2);
      expect(
        within(paginationRegion).getByRole('button', { name: '1' }),
      ).toBeInTheDocument();
      expect(
        within(paginationRegion).getByRole('button', { name: '20' }),
      ).toBeInTheDocument();
    });

    it('shows ellipsis at start when currentPage is near end', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 19,
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
      const ellipsis = within(paginationRegion).getAllByText('…');
      // Should have ellipsis at the start
      expect(ellipsis.length).toBeGreaterThan(0);
      expect(
        within(paginationRegion).getByRole('button', { name: '1' }),
      ).toBeInTheDocument();
      expect(
        within(paginationRegion).getByRole('button', { name: '20' }),
      ).toBeInTheDocument();
    });
  });

  describe('Status badges', () => {
    it('renders Unassigned status badge', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ status: 'UNASSIGNED' })]}
          onAssign={vi.fn()}
        />,
      );

      // Find all "Unassigned" texts and get the one that's a status badge (has rounded-full class)
      const allUnassigned = screen.getAllByText('Unassigned');
      const statusBadge = allUnassigned.find((el) =>
        el.className.includes('rounded-full'),
      );
      expect(statusBadge).toBeInTheDocument();
    });

    it('renders Assigned status badge', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ status: 'ASSIGNED', assignee: 'user-1' })]}
          onAssign={vi.fn()}
        />,
      );

      // "Assigned" should only appear once (as status badge)
      expect(screen.getByText('Assigned')).toBeInTheDocument();
    });

    it('renders In Progress status badge', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ status: 'IN_PROGRESS', assignee: 'user-1' })]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('renders Completed status badge', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ status: 'COMPLETED', assignee: 'user-1' })]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders Blocked status badge for Suspended status', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ status: 'SUSPENDED', assignee: 'user-1' })]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
  });

  describe('Action buttons edge cases', () => {
    it('does not show Complete button for IN_PROGRESS task without assignee', () => {
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'IN_PROGRESS',
              assignee: undefined,
            }),
          ]}
          onAssign={vi.fn()}
          onComplete={vi.fn()}
        />,
      );

      // For IN_PROGRESS without assignee, the component returns early with no actions
      expect(
        screen.queryByRole('button', { name: /Complete/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Assign/i }),
      ).not.toBeInTheDocument();
    });

    it('does not show Complete button for IN_PROGRESS task without onComplete handler', () => {
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'IN_PROGRESS',
              assignee: 'user-1',
            }),
          ]}
          onAssign={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /Complete/i }),
      ).not.toBeInTheDocument();
    });

    it('does not show Reassign button when onReassign handler is not provided', () => {
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
            }),
          ]}
          onAssign={vi.fn()}
          onUnassign={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /Reassign/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Unassign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Status/i }),
      ).toBeInTheDocument();
    });

    it('does not show Unassign button when onUnassign handler is not provided', () => {
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
          onUpdateStatus={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /Unassign/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Reassign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Status/i }),
      ).toBeInTheDocument();
    });

    it('does not show Status button when onUpdateStatus handler is not provided', () => {
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
        />,
      );

      expect(
        screen.queryByRole('button', { name: /Status/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Reassign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Unassign/i }),
      ).toBeInTheDocument();
    });

    it('calls onReassign when Reassign button is clicked', () => {
      const onReassign = vi.fn();
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
            }),
          ]}
          onAssign={vi.fn()}
          onReassign={onReassign}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Reassign/i }));
      expect(onReassign).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1' }),
      );
    });

    it('calls onUnassign when Unassign button is clicked', () => {
      const onUnassign = vi.fn();
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
            }),
          ]}
          onAssign={vi.fn()}
          onUnassign={onUnassign}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Unassign/i }));
      expect(onUnassign).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1' }),
      );
    });

    it('calls onUpdateStatus when Status button is clicked', () => {
      const onUpdateStatus = vi.fn();
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
            }),
          ]}
          onAssign={vi.fn()}
          onUpdateStatus={onUpdateStatus}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Status/i }));
      expect(onUpdateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1' }),
      );
    });
  });

  describe('Task rendering edge cases', () => {
    it('renders task without ID', () => {
      render(
        <WorkQueueTable
          tasks={[
            {
              ...buildTask(),
              id: '',
              taskId: '',
            } as UnifiedWorkQueueTask,
          ]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('No ID')).toBeInTheDocument();
    });

    it('renders task without name', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ name: undefined })]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('task-1')).toBeInTheDocument();
      expect(screen.queryByText('Investigate alert')).not.toBeInTheDocument();
    });

    it('renders task without caseId', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ caseId: undefined })]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('task-1')).toBeInTheDocument();
    });

    it('renders task without candidateGroup', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask({ candidateGroup: undefined })]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders assignee name when assigneeName is provided', () => {
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
              assigneeName: 'John Doe',
            }),
          ]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders assignee ID when assigneeName is not provided', () => {
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
              assigneeName: undefined,
            }),
          ]}
          onAssign={vi.fn()}
        />,
      );

      expect(screen.getByText('user-1')).toBeInTheDocument();
    });
  });

  describe('Action button combinations', () => {
    it('shows Assign button for ASSIGNED task without assignee', () => {
      const onAssign = vi.fn();
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: undefined,
            }),
          ]}
          onAssign={onAssign}
        />,
      );

      const assignButton = screen.getByRole('button', { name: /Assign/i });
      expect(assignButton).toBeInTheDocument();
      fireEvent.click(assignButton);
      expect(onAssign).toHaveBeenCalled();
    });

    it('shows Assign button for SUSPENDED task without assignee', () => {
      const onAssign = vi.fn();
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'SUSPENDED',
              assignee: undefined,
            }),
          ]}
          onAssign={onAssign}
        />,
      );

      const assignButton = screen.getByRole('button', { name: /Assign/i });
      expect(assignButton).toBeInTheDocument();
      fireEvent.click(assignButton);
      expect(onAssign).toHaveBeenCalled();
    });

    it('shows all action buttons when all handlers are provided for assigned task', () => {
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

    it('shows only Reassign and Unassign when onUpdateStatus is not provided', () => {
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
        />,
      );

      expect(screen.getByRole('button', { name: /Reassign/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Unassign/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Status/i }),
      ).not.toBeInTheDocument();
    });

    it('shows only Reassign and Status when onUnassign is not provided', () => {
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
          onUpdateStatus={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /Reassign/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Unassign/i }),
      ).not.toBeInTheDocument();
    });

    it('shows only Unassign and Status when onReassign is not provided', () => {
      render(
        <WorkQueueTable
          tasks={[
            buildTask({
              status: 'ASSIGNED',
              assignee: 'user-1',
            }),
          ]}
          onAssign={vi.fn()}
          onUnassign={vi.fn()}
          onUpdateStatus={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /Unassign/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Reassign/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Pagination edge cases', () => {
    it('handles pagination when currentPage is at maximum', () => {
      const onPageChange = vi.fn();
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 10,
            pageSize: 5,
            totalItems: 50,
            totalPages: 10,
            onPageChange,
          }}
        />,
      );

      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it('calculates correct pagination range when on last page', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 3,
            pageSize: 5,
            totalItems: 13, // Last page has only 3 items
            totalPages: 3,
            onPageChange: vi.fn(),
          }}
        />,
      );

      // Should show "Showing 11 to 13 of 13 tasks"
      const paginationText = screen.getByText(/Showing/i).textContent || '';
      expect(paginationText).toMatch(/11.*to.*13.*of.*13.*tasks/i);
    });

    it('handles pagination when totalItems is less than pageSize', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 1,
            pageSize: 10,
            totalItems: 3,
            totalPages: 1,
            onPageChange: vi.fn(),
          }}
        />,
      );

      // Should show "Showing 1 to 3 of 3 tasks"
      expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    });

    it('handles pagination when currentPage would go below 1', () => {
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

      const previousButton = screen.getByRole('button', { name: /Previous/i });
      expect(previousButton).toBeDisabled();
      // Even if clicked, Math.max(1, 0) = 1, so it shouldn't go below 1
      fireEvent.click(previousButton);
      // Button is disabled, so click shouldn't trigger
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('handles pagination when currentPage would exceed totalPages', () => {
      const onPageChange = vi.fn();
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 2,
            pageSize: 5,
            totalItems: 10,
            totalPages: 2,
            onPageChange,
          }}
        />,
      );

      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
      // Even if clicked, Math.min(2, 3) = 2, so it shouldn't exceed totalPages
      fireEvent.click(nextButton);
      // Button is disabled, so click shouldn't trigger
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('renders pagination info correctly for first page', () => {
      render(
        <WorkQueueTable
          tasks={[buildTask()]}
          onAssign={vi.fn()}
          pagination={{
            currentPage: 1,
            pageSize: 5,
            totalItems: 25,
            totalPages: 5,
            onPageChange: vi.fn(),
          }}
        />,
      );

      // Should show "Showing 1 to 5 of 25 tasks"
      const paginationText = screen.getByText(/Showing/i).textContent || '';
      expect(paginationText).toMatch(/Showing.*1.*to.*5.*of.*25.*tasks/i);
    });
  });
});

