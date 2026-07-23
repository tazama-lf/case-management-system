import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskLogTable from '../TaskLogTable';
import type { UnifiedWorkQueueTask } from '../../../../types/task.types';

vi.mock('../../../../../shared/utils/dateUtils', () => ({
  formatDate: (date: string) => date,
}));

const mockTasks: UnifiedWorkQueueTask[] = [
  {
    id: 'TASK-1',
    name: 'Investigate Transaction',
    caseId: 'CASE-1',
    status: 'UNASSIGNED',
    assignee: null,
    createdAt: '2024-01-01T00:00:00Z',
    created: '2024-01-01T00:00:00Z',
    dueDate: null,
    description: 'Review suspicious transaction',
  },
  {
    id: 'TASK-2',
    name: 'Complete Review',
    caseId: 'CASE-2',
    status: 'IN_PROGRESS',
    assignee: 'user-1',
    assigneeName: 'John Doe',
    createdAt: '2024-01-02T00:00:00Z',
    created: '2024-01-02T00:00:00Z',
    dueDate: null,
    description: 'Complete review',
  },
  {
    id: 'TASK-3',
    name: 'Closed Task',
    caseId: 'CASE-3',
    status: 'COMPLETED',
    assignee: 'user-2',
    assigneeName: 'Jane Smith',
    createdAt: '2024-01-03T00:00:00Z',
    created: '2024-01-03T00:00:00Z',
    dueDate: null,
    description: 'Already completed',
  },
  {
    id: 'TASK-4',
    name: 'Assigned Task',
    caseId: 'CASE-4',
    status: 'ASSIGNED',
    assignee: 'user-3',
    createdAt: '2024-01-04T00:00:00Z',
    created: '2024-01-04T00:00:00Z',
    dueDate: null,
    description: 'Assigned but not started',
  },
  {
    id: 'TASK-5',
    name: 'Suspended Task',
    caseId: 'CASE-5',
    status: 'SUSPENDED',
    assignee: 'user-4',
    createdAt: '2024-01-05T00:00:00Z',
    created: '2024-01-05T00:00:00Z',
    dueDate: null,
    description: 'Task is suspended',
  },
];

describe('TaskLogTable', () => {
  const mockOnAssign = vi.fn();
  const mockOnUnassign = vi.fn();
  const mockOnReassign = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnUpdateStatus = vi.fn();
  const mockOnCaseIdClick = vi.fn();
  const mockOnTaskClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table with tasks', () => {
    render(<TaskLogTable tasks={mockTasks} onAssign={mockOnAssign} />);

    expect(screen.getByText('Task ID')).toBeInTheDocument();
    expect(screen.getByText('TASK-1')).toBeInTheDocument();
    expect(screen.getByText('Investigate Transaction')).toBeInTheDocument();
  });

  it('displays all table columns', () => {
    render(<TaskLogTable tasks={mockTasks} onAssign={mockOnAssign} />);

    expect(screen.getByText('Task ID')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Assigned To')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('calls onAssign when assign button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskLogTable tasks={mockTasks} onAssign={mockOnAssign} />);

    const assignButton = screen.getByTitle('Assign task');
    await user.click(assignButton);

    expect(mockOnAssign).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('calls onComplete when complete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        onComplete={mockOnComplete}
      />,
    );

    const completeButton = screen.getByTitle('Mark complete');
    await user.click(completeButton);

    expect(mockOnComplete).toHaveBeenCalledWith(mockTasks[1]);
  });

  it('calls onReassign when reassign button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskLogTable
        tasks={[mockTasks[3]]}
        onAssign={mockOnAssign}
        onReassign={mockOnReassign}
      />,
    );

    const reassignButton = screen.getByTitle('Reassign task');
    await user.click(reassignButton);
    expect(mockOnReassign).toHaveBeenCalledWith(mockTasks[3]);
  });

  it('calls onUnassign when unassign button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskLogTable
        tasks={[mockTasks[3]]}
        onAssign={mockOnAssign}
        onUnassign={mockOnUnassign}
      />,
    );

    const unassignButton = screen.getByTitle('Unassign task');
    await user.click(unassignButton);
    expect(mockOnUnassign).toHaveBeenCalledWith(mockTasks[3]);
  });

  it('calls onTaskClick when row is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        onTaskClick={mockOnTaskClick}
      />,
    );

    const taskIdCell = screen.getByText('TASK-1');
    await user.click(taskIdCell);
    expect(mockOnTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('displays empty state when no tasks', () => {
    render(<TaskLogTable tasks={[]} onAssign={mockOnAssign} />);

    expect(screen.getByText(/No tasks found/i)).toBeInTheDocument();
  });

  it('renders status badges with correct labels', () => {
    render(<TaskLogTable tasks={mockTasks} onAssign={mockOnAssign} />);

    expect(screen.getByText('STATUS_01_UNASSIGNED')).toBeInTheDocument();
    expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('STATUS_30_COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('STATUS_10_ASSIGNED')).toBeInTheDocument();
    expect(screen.getByText('STATUS_21_BLOCKED')).toBeInTheDocument();
  });

  it('does not show action buttons for completed tasks', () => {
    render(
      <TaskLogTable
        tasks={[mockTasks[2]]}
        onAssign={mockOnAssign}
        onComplete={mockOnComplete}
        onReassign={mockOnReassign}
        onUnassign={mockOnUnassign}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(screen.queryByTitle('Mark complete')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reassign task')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Unassign task')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Update status')).not.toBeInTheDocument();
  });

  it('does not show complete button for investigation tasks in progress', () => {
    const investigationTask: UnifiedWorkQueueTask = {
      id: 'TASK-INV',
      name: 'Investigate case details',
      caseId: 'CASE-INV',
      status: 'IN_PROGRESS',
      assignee: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      created: '2024-01-01T00:00:00Z',
      dueDate: null,
      description: 'Investigation task',
    };

    render(
      <TaskLogTable
        tasks={[investigationTask]}
        onAssign={mockOnAssign}
        onComplete={mockOnComplete}
      />,
    );

    expect(screen.queryByTitle('Mark complete')).not.toBeInTheDocument();
  });

  it('shows assign button for unassigned tasks', () => {
    render(<TaskLogTable tasks={[mockTasks[0]]} onAssign={mockOnAssign} />);

    expect(screen.getByTitle('Assign task')).toBeInTheDocument();
  });

  it('shows reassign, unassign and status buttons for assigned tasks', () => {
    render(
      <TaskLogTable
        tasks={[mockTasks[3]]}
        onAssign={mockOnAssign}
        onReassign={mockOnReassign}
        onUnassign={mockOnUnassign}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(screen.getByTitle('Reassign task')).toBeInTheDocument();
    expect(screen.getByTitle('Unassign task')).toBeInTheDocument();
    expect(screen.getByTitle('Update status')).toBeInTheDocument();
  });

  it('calls onUpdateStatus when status button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TaskLogTable
        tasks={[mockTasks[3]]}
        onAssign={mockOnAssign}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    const statusButton = screen.getByTitle('Update status');
    await user.click(statusButton);

    expect(mockOnUpdateStatus).toHaveBeenCalledWith(mockTasks[3]);
  });

  it('displays assignee name when available', () => {
    render(<TaskLogTable tasks={[mockTasks[1]]} onAssign={mockOnAssign} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays "Unassigned" for tasks without assignee', () => {
    render(<TaskLogTable tasks={[mockTasks[0]]} onAssign={mockOnAssign} />);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('displays candidateGroup when available', () => {
    const taskWithQueue: UnifiedWorkQueueTask = {
      ...mockTasks[0],
      candidateGroup: 'Investigation Queue',
    };
    render(<TaskLogTable tasks={[taskWithQueue]} onAssign={mockOnAssign} />);

    expect(screen.getByText('Investigation Queue')).toBeInTheDocument();
  });

  it('renders pagination controls', () => {
    const mockPagination = {
      currentPage: 2,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
      onPageChange: vi.fn(),
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });

  it('calls onPageChange when next button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();
    const mockPagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
      onPageChange: mockOnPageChange,
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    await user.click(screen.getByText('Next'));

    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when previous button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();
    const mockPagination = {
      currentPage: 3,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
      onPageChange: mockOnPageChange,
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    await user.click(screen.getByText('Previous'));

    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('disables previous button on first page', () => {
    const mockPagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
      onPageChange: vi.fn(),
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    const mockPagination = {
      currentPage: 5,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
      onPageChange: vi.fn(),
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('renders page numbers and handles page click', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();
    const mockPagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 30,
      totalPages: 3,
      onPageChange: mockOnPageChange,
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    await user.click(screen.getByText('3'));

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('renders ellipsis for many pages', () => {
    const mockPagination = {
      currentPage: 5,
      pageSize: 10,
      totalItems: 200,
      totalPages: 20,
      onPageChange: vi.fn(),
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('renders task with no id as "No ID"', () => {
    const taskNoId: UnifiedWorkQueueTask = {
      id: '',
      name: 'Some Task',
      caseId: 'CASE-X',
      status: 'UNASSIGNED',
      assignee: null,
      createdAt: '2024-01-01T00:00:00Z',
      created: '2024-01-01T00:00:00Z',
      dueDate: null,
      description: 'No ID task',
    };

    render(<TaskLogTable tasks={[taskNoId]} onAssign={mockOnAssign} />);

    expect(screen.getByText('No ID')).toBeInTheDocument();
  });

  it('renders task with null name as "Unnamed Task"', () => {
    const taskNoName = {
      id: 'TASK-NO-NAME',
      name: null as unknown as string,
      caseId: 'CASE-X',
      status: 'UNASSIGNED',
      assignee: null,
      createdAt: '2024-01-01T00:00:00Z',
      created: '2024-01-01T00:00:00Z',
      dueDate: null,
      description: 'No name task',
    };

    render(
      <TaskLogTable
        tasks={[taskNoName as UnifiedWorkQueueTask]}
        onAssign={mockOnAssign}
      />,
    );

    expect(screen.getByText('Unnamed Task')).toBeInTheDocument();
  });

  it('shows correct pagination info text', () => {
    const mockPagination = {
      currentPage: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      onPageChange: vi.fn(),
    };

    render(
      <TaskLogTable
        tasks={mockTasks}
        onAssign={mockOnAssign}
        pagination={mockPagination}
      />,
    );

    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
