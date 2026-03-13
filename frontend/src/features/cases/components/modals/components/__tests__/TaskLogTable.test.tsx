import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskLogTable from '../TaskLogTable';
import type { UnifiedWorkQueueTask } from '../../../../../cases/types/task.types';

vi.mock('../../../../../../shared/utils/dateUtils', () => ({
  formatDate: (date: string) => date,
}));

vi.mock('../../../../../../shared/components/ui', () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">{title} - {description}</div>
  ),
}));

const baseTasks: UnifiedWorkQueueTask[] = [
  {
    id: 1,
    name: 'Review Transaction',
    caseId: 100,
    status: 'UNASSIGNED',
    assignee: undefined,
    createdAt: '2024-01-01T00:00:00Z',
    created: '2024-01-01T00:00:00Z',
    candidateGroup: 'investigation',
    description: 'Review suspicious transaction',
  },
  {
    id: 2,
    name: 'Complete Analysis',
    caseId: 200,
    status: 'IN_PROGRESS',
    assignee: 'user-1',
    assigneeName: 'John Doe',
    createdAt: '2024-01-02T00:00:00Z',
    created: '2024-01-02T00:00:00Z',
    candidateGroup: 'analysis',
    description: 'Complete analysis',
  },
  {
    id: 3,
    name: 'Investigate case for fraud',
    caseId: 300,
    status: 'IN_PROGRESS',
    assignee: 'user-2',
    assigneeName: 'Jane Smith',
    createdAt: '2024-01-03T00:00:00Z',
    created: '2024-01-03T00:00:00Z',
    candidateGroup: 'investigation',
    description: 'Investigate the case',
  },
  {
    id: 4,
    name: 'Final Review',
    caseId: 400,
    status: 'COMPLETED',
    assignee: 'user-3',
    createdAt: '2024-01-04T00:00:00Z',
    created: '2024-01-04T00:00:00Z',
  },
  {
    id: 5,
    name: 'Assigned task',
    caseId: 500,
    status: 'ASSIGNED',
    assignee: 'user-4',
    createdAt: '2024-01-05T00:00:00Z',
    created: '2024-01-05T00:00:00Z',
  },
  {
    id: 6,
    name: 'Suspended task',
    caseId: 600,
    status: 'SUSPENDED',
    assignee: 'user-5',
    createdAt: '2024-01-06T00:00:00Z',
    created: '2024-01-06T00:00:00Z',
  },
];

describe('TaskLogTable', () => {
  const mockOnAssign = vi.fn();
  const mockOnUnassign = vi.fn();
  const mockOnReassign = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnUpdateStatus = vi.fn();
  const mockOnTaskClick = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  // ─── Rendering ────────────────────────────────────────────────

  it('renders all column headers', () => {
    render(<TaskLogTable tasks={baseTasks} onAssign={mockOnAssign} />);
    ['Task ID', 'Title', 'Case ID', 'Queue', 'Status', 'Created', 'Assigned To', 'Actions'].forEach(header => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
  });

  it('renders task IDs and names', () => {
    render(<TaskLogTable tasks={baseTasks} onAssign={mockOnAssign} />);
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    expect(screen.getByText('Complete Analysis')).toBeInTheDocument();
  });

  it('shows "No ID" when task has no id', () => {
    const noIdTask: UnifiedWorkQueueTask[] = [
      { id: undefined as any, name: 'No id task', status: 'UNASSIGNED', createdAt: '' },
    ];
    render(<TaskLogTable tasks={noIdTask} onAssign={mockOnAssign} />);
    expect(screen.getByText('No ID')).toBeInTheDocument();
  });

  it('shows "Unnamed Task" when task has no name', () => {
    const noNameTask: UnifiedWorkQueueTask[] = [
      { id: 10, name: undefined as any, status: 'UNASSIGNED', createdAt: '' },
    ];
    render(<TaskLogTable tasks={noNameTask} onAssign={mockOnAssign} />);
    expect(screen.getByText('Unnamed Task')).toBeInTheDocument();
  });

  it('shows "Unassigned" for tasks without assignee', () => {
    render(<TaskLogTable tasks={[baseTasks[0]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows assignee name for assigned tasks', () => {
    render(<TaskLogTable tasks={[baseTasks[1]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows candidateGroup as queue', () => {
    render(<TaskLogTable tasks={[baseTasks[0]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('investigation')).toBeInTheDocument();
  });

  it('shows "-" when no candidateGroup', () => {
    const task: UnifiedWorkQueueTask[] = [
      { id: 99, name: 'test', status: 'UNASSIGNED', createdAt: '' },
    ];
    render(<TaskLogTable tasks={task} onAssign={mockOnAssign} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  // ─── Empty state ──────────────────────────────────────────────

  it('shows empty state when no tasks', () => {
    render(<TaskLogTable tasks={[]} onAssign={mockOnAssign} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  // ─── Status badges ──────────────────────────────────────────

  it('renders UNASSIGNED badge', () => {
    render(<TaskLogTable tasks={[baseTasks[0]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('STATUS_01_UNASSIGNED')).toBeInTheDocument();
  });

  it('renders ASSIGNED badge', () => {
    render(<TaskLogTable tasks={[baseTasks[4]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('STATUS_10_ASSIGNED')).toBeInTheDocument();
  });

  it('renders IN_PROGRESS badge', () => {
    render(<TaskLogTable tasks={[baseTasks[1]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
  });

  it('renders COMPLETED badge', () => {
    render(<TaskLogTable tasks={[baseTasks[3]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('STATUS_30_COMPLETED')).toBeInTheDocument();
  });

  it('renders SUSPENDED badge', () => {
    render(<TaskLogTable tasks={[baseTasks[5]]} onAssign={mockOnAssign} />);
    expect(screen.getByText('STATUS_21_BLOCKED')).toBeInTheDocument();
  });

  it('defaults to UNASSIGNED badge for unknown status', () => {
    const task: UnifiedWorkQueueTask[] = [
      { id: 99, name: 'test', status: 'WEIRD_STATUS', createdAt: '' },
    ];
    render(<TaskLogTable tasks={task} onAssign={mockOnAssign} />);
    expect(screen.getByText('STATUS_01_UNASSIGNED')).toBeInTheDocument();
  });

  // ─── Actions ──────────────────────────────────────────────────

  it('shows Assign button for UNASSIGNED tasks', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[0]]} onAssign={mockOnAssign} />);
    const btn = screen.getByTitle('Assign task');
    await user.click(btn);
    expect(mockOnAssign).toHaveBeenCalledWith(baseTasks[0]);
  });

  it('shows Complete button for IN_PROGRESS non-investigation task with assignee', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[1]]} onAssign={mockOnAssign} onComplete={mockOnComplete} />);
    const btn = screen.getByTitle('Mark complete');
    await user.click(btn);
    expect(mockOnComplete).toHaveBeenCalledWith(baseTasks[1]);
  });

  it('hides Complete button for IN_PROGRESS investigation task', () => {
    render(<TaskLogTable tasks={[baseTasks[2]]} onAssign={mockOnAssign} onComplete={mockOnComplete} />);
    expect(screen.queryByTitle('Mark complete')).not.toBeInTheDocument();
  });

  it('shows no action buttons for COMPLETED tasks', () => {
    render(
      <TaskLogTable
        tasks={[baseTasks[3]]}
        onAssign={mockOnAssign}
        onComplete={mockOnComplete}
        onReassign={mockOnReassign}
        onUnassign={mockOnUnassign}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark complete')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reassign task')).not.toBeInTheDocument();
  });

  it('shows Reassign button for assigned non-IN_PROGRESS task', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[4]]} onAssign={mockOnAssign} onReassign={mockOnReassign} />);
    const btn = screen.getByTitle('Reassign task');
    await user.click(btn);
    expect(mockOnReassign).toHaveBeenCalledWith(baseTasks[4]);
  });

  it('shows Unassign button for assigned task', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[4]]} onAssign={mockOnAssign} onUnassign={mockOnUnassign} />);
    const btn = screen.getByTitle('Unassign task');
    await user.click(btn);
    expect(mockOnUnassign).toHaveBeenCalledWith(baseTasks[4]);
  });

  it('shows Update Status button for assigned task', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[4]]} onAssign={mockOnAssign} onUpdateStatus={mockOnUpdateStatus} />);
    const btn = screen.getByTitle('Update status');
    await user.click(btn);
    expect(mockOnUpdateStatus).toHaveBeenCalledWith(baseTasks[4]);
  });

  // ─── Task click (investigation tasks) ────────────────────────

  it('makes investigation task rows clickable when onTaskClick provided', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[2]]} onAssign={mockOnAssign} onTaskClick={mockOnTaskClick} />);

    // Click the first <td> which has the onClick
    const td = screen.getByText(/Investigate case for fraud/).closest('tr')!.querySelector('td')!;
    await user.click(td);
    expect(mockOnTaskClick).toHaveBeenCalledWith(baseTasks[2]);
  });

  it('does not call onTaskClick for non-investigation tasks', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={[baseTasks[0]]} onAssign={mockOnAssign} onTaskClick={mockOnTaskClick} />);
    
    const td = screen.getByText('Review Transaction').closest('tr')!.querySelector('td')!;
    await user.click(td);
    expect(mockOnTaskClick).not.toHaveBeenCalled();
  });

  // ─── Pagination ────────────────────────────────────────────

  it('renders pagination when provided', () => {
    const onPageChange = vi.fn();
    render(
      <TaskLogTable
        tasks={baseTasks.slice(0, 2)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 1, pageSize: 2, totalItems: 6, totalPages: 3, onPageChange }}
      />,
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('disables Previous on first page', () => {
    render(
      <TaskLogTable
        tasks={baseTasks.slice(0, 2)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 1, pageSize: 2, totalItems: 6, totalPages: 3, onPageChange: vi.fn() }}
      />,
    );
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(
      <TaskLogTable
        tasks={baseTasks.slice(4)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 3, pageSize: 2, totalItems: 6, totalPages: 3, onPageChange: vi.fn() }}
      />,
    );
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('calls onPageChange when Next is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TaskLogTable
        tasks={baseTasks.slice(0, 2)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 1, pageSize: 2, totalItems: 6, totalPages: 3, onPageChange }}
      />,
    );

    await user.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when Previous is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TaskLogTable
        tasks={baseTasks.slice(2, 4)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 2, pageSize: 2, totalItems: 6, totalPages: 3, onPageChange }}
      />,
    );

    await user.click(screen.getByText('Previous'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when a page number button is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TaskLogTable
        tasks={baseTasks.slice(0, 2)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 1, pageSize: 2, totalItems: 6, totalPages: 3, onPageChange }}
      />,
    );

    await user.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders ellipsis for many pages', () => {
    render(
      <TaskLogTable
        tasks={baseTasks.slice(0, 2)}
        onAssign={mockOnAssign}
        pagination={{ currentPage: 5, pageSize: 2, totalItems: 100, totalPages: 50, onPageChange: vi.fn() }}
      />,
    );
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('does not render pagination when not provided', () => {
    render(<TaskLogTable tasks={baseTasks} onAssign={mockOnAssign} />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});
