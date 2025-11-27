import React from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { describe, it, beforeEach, vi, expect } from 'vitest';
import WorkQueueDashboard from '../WorkQueueDashboard';

const mockNavigate = vi.fn();
const mockParams: Record<string, string | undefined> = {};

const mockUseWorkQueuePagination = vi.fn();
const mockGetWorkQueueByGroup = vi.fn();
const mockGetCandidateGroups = vi.fn();
const mockAssignTask = vi.fn();
const mockUnassignTask = vi.fn();
const mockCompleteTask = vi.fn();
const mockUpdateTaskForSupervisor = vi.fn();

const mockUseWorkQueueErrorHandler = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const latestAssignModalProps: { current: any } = { current: null };
const latestReassignModalProps: { current: any } = { current: null };
const latestUnassignModalProps: { current: any } = { current: null };
const latestCompleteModalProps: { current: any } = { current: null };
const latestUpdateStatusModalProps: { current: any } = { current: null };

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
}));

vi.mock('@/shared/components/ui/ResultsSummary', () => ({
  __esModule: true,
  default: () => <div data-testid="results-summary">results-summary</div>,
}));

vi.mock('@/features/workqueue/components/WorkQueueTable', () => ({
  __esModule: true,
  default: ({
    tasks,
    onAssign,
    onReassign,
    onUnassign,
    onComplete,
    onUpdateStatus,
  }: {
    tasks: Array<{ id: string }>;
    onAssign?: (task: any) => void;
    onReassign?: (task: any) => void;
    onUnassign?: (task: any) => void;
    onComplete?: (task: any) => void;
    onUpdateStatus?: (task: any) => void;
  }) => (
    <div data-testid="workqueue-table">
      {tasks.map((task) => task.id).join(', ') || 'no-tasks'}
      {tasks.length > 0 && (
        <div>
          {onAssign && (
            <button
              data-testid="trigger-assign"
              onClick={() => onAssign(tasks[0])}
            >
              trigger assign
            </button>
          )}
          {onReassign && (
            <button
              data-testid="trigger-reassign"
              onClick={() => onReassign(tasks[0])}
            >
              trigger reassign
            </button>
          )}
          {onUnassign && (
            <button
              data-testid="trigger-unassign"
              onClick={() => onUnassign(tasks[0])}
            >
              trigger unassign
            </button>
          )}
          {onComplete && (
            <button
              data-testid="trigger-complete"
              onClick={() => onComplete(tasks[0])}
            >
              trigger complete
            </button>
          )}
          {onUpdateStatus && (
            <button
              data-testid="trigger-update-status"
              onClick={() => onUpdateStatus(tasks[0])}
            >
              trigger update
            </button>
          )}
        </div>
      )}
    </div>
  ),
}));

vi.mock('@/features/workqueue/components/WorkQueueTableSkeleton', () => ({
  __esModule: true,
  default: ({ rows }: { rows: number }) => (
    <div data-testid="workqueue-skeleton">skeleton-{rows}</div>
  ),
}));

vi.mock('@/features/workqueue/components/WorkQueueErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkQueueErrorHandler: (...args: unknown[]) =>
    mockUseWorkQueueErrorHandler(...args),
}));

vi.mock('@/features/workqueue/services/flowableWorkQueueService', () => ({
  flowableWorkQueueService: {
    getWorkQueueByGroup: (...args: unknown[]) =>
      mockGetWorkQueueByGroup(...args),
    getCandidateGroups: (...args: unknown[]) =>
      mockGetCandidateGroups(...args),
    assignTask: (...args: unknown[]) => mockAssignTask(...args),
    unassignTask: (...args: unknown[]) => mockUnassignTask(...args),
    completeTask: (...args: unknown[]) => mockCompleteTask(...args),
  },
}));

vi.mock('@/features/workqueue/hooks/useWorkQueuePagination', () => ({
  useWorkQueuePagination: (...args: unknown[]) =>
    mockUseWorkQueuePagination(...args),
}));

vi.mock('@/shared/providers/ToastProvider', () => {
  return {
    useToast: () => ({
      success: mockToastSuccess,
      error: mockToastError,
    }),
  };
});

vi.mock('@/shared/utils/routeUtils', () => ({
  useDynamicRoute: () => ({
    params: mockParams,
    navigate: mockNavigate,
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { userId: 'investigator-1' },
    hasInvestigatorRole: () => true,
    hasSupervisorRole: () => false,
    hasCMSAdminRole: () => false,
  }),
}));

vi.mock('@/features/cases/services/taskService', () => ({
  taskService: {
    updateTaskForSupervisor: (...args: unknown[]) =>
      mockUpdateTaskForSupervisor(...args),
  },
  TaskStatus: {
    STATUS_01_UNASSIGNED: 'STATUS_01_UNASSIGNED',
    STATUS_10_ASSIGNED: 'STATUS_10_ASSIGNED',
    STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
    STATUS_21_BLOCKED: 'STATUS_21_BLOCKED',
    STATUS_30_COMPLETED: 'STATUS_30_COMPLETED',
  },
  TaskStatusType: {},
}));

vi.mock('@/features/cases/components/modals/AssignTaskModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestAssignModalProps.current = props;
    if (!props.open) return null;
    return (
      <button
        data-testid="confirm-assign"
        onClick={() => props.onAssign?.(props.task, 'agent-2')}
      >
        confirm assign
      </button>
    );
  },
}));
vi.mock('@/features/cases/components/modals/ReassignTaskModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestReassignModalProps.current = props;
    if (!props.open) return null;
    return (
      <button
        data-testid="confirm-reassign"
        onClick={() => props.onReassign?.(props.task, 'agent-3', 'Justification')}
      >
        confirm reassign
      </button>
    );
  },
}));
vi.mock('@/features/cases/components/modals/UnassignTaskModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestUnassignModalProps.current = props;
    if (!props.open) return null;
    return (
      <button
        data-testid="confirm-unassign"
        onClick={() => props.onUnassign?.(props.task?.id, 'No longer needed')}
      >
        confirm unassign
      </button>
    );
  },
}));
vi.mock('@/features/cases/components/modals/CompleteTaskModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestCompleteModalProps.current = props;
    if (!props.open) return null;
    return (
      <button
        data-testid="confirm-complete"
        onClick={() => props.onCompleteTask?.(props.task, 'Notes')}
      >
        confirm complete
      </button>
    );
  },
}));
vi.mock('@/features/cases/components/modals/UpdateTaskStatusModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestUpdateStatusModalProps.current = props;
    if (!props.open) return null;
    return (
      <button
        data-testid="confirm-update-status"
        onClick={() => props.onUpdateStatus?.(props.task, 'Assigned')}
      >
        confirm update status
      </button>
    );
  },
}));

const createErrorHandler = (
  overrides: Partial<ReturnType<typeof mockUseWorkQueueErrorHandler>> = {},
) => ({
  error: null,
  handleError: vi.fn(),
  clearError: vi.fn(),
  getErrorDisplay: vi.fn(() => null),
  ...overrides,
});

describe('WorkQueueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.taskId = undefined;
    latestAssignModalProps.current = null;
    latestReassignModalProps.current = null;
    latestUpdateStatusModalProps.current = null;
    latestUnassignModalProps.current = null;
    latestCompleteModalProps.current = null;
    mockUseWorkQueuePagination.mockImplementation((tasks: unknown[]) => ({
      pagination: {
        currentPage: 1,
        pageSize: 10,
        totalItems: tasks.length,
        totalPages: 1,
        onPageChange: vi.fn(),
      },
      paginatedTasks: tasks,
      setPageSize: vi.fn(),
    }));

    mockGetCandidateGroups.mockReturnValue([
      { value: 'investigations', label: 'Investigations' },
    ]);
    mockUseWorkQueueErrorHandler.mockReturnValue(createErrorHandler());
    mockGetWorkQueueByGroup.mockResolvedValue([]);
    mockAssignTask.mockResolvedValue(undefined);
    mockUnassignTask.mockResolvedValue(undefined);
    mockCompleteTask.mockResolvedValue(undefined);
    mockUpdateTaskForSupervisor.mockResolvedValue(undefined);
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
  });

  it('renders skeleton while loading tasks', () => {
    mockGetWorkQueueByGroup.mockReturnValue(new Promise(() => {}));

    render(<WorkQueueDashboard />);

    expect(screen.getByTestId('workqueue-skeleton')).toHaveTextContent(
      'skeleton-10',
    );
  });

  it('renders results summary and table once tasks load', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'ASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup.mockResolvedValue([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() =>
      expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
        'task-123',
      ),
    );
    expect(screen.getByTestId('results-summary')).toBeInTheDocument();
  });

  it('shows empty state when no tasks are available after loading', async () => {
    mockGetWorkQueueByGroup.mockResolvedValue([]);

    render(<WorkQueueDashboard />);

    await waitFor(() =>
      expect(
        screen.getByText(/No tasks found in Investigations/i),
      ).toBeInTheDocument(),
    );
  });

  it('displays error info and allows retry when error handler reports an issue', () => {
    const clearError = vi.fn();
    const getErrorDisplay = vi.fn(() => ({
      message: 'Unable to load',
      actionSuggestion: 'Retry shortly',
      canRetry: true,
    }));
    mockUseWorkQueueErrorHandler.mockReturnValue(
      createErrorHandler({
        error: new Error('boom'),
        clearError,
        getErrorDisplay,
      }),
    );
    mockGetWorkQueueByGroup.mockReturnValue(new Promise(() => {}));

    render(<WorkQueueDashboard />);

    expect(screen.getByText(/Unable to load/i)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryButton);
    expect(clearError).toHaveBeenCalled();
  });

  it('navigates back to work queue when taskId param does not match', async () => {
    mockParams.taskId = 'missing';
    mockGetCandidateGroups.mockReturnValue([
      { value: 'investigations', label: 'Investigations' },
    ]);
    mockGetWorkQueueByGroup.mockResolvedValue([
      {
        id: 'some-other-task',
        taskId: 'some-other-task',
        name: 'Test',
        status: 'ASSIGNED',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      },
    ]);

    render(<WorkQueueDashboard />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/work-queue'),
    );
  });

  it('reloads tasks when queue selection changes', async () => {
    mockGetCandidateGroups.mockReturnValue([
      { value: 'investigations', label: 'Investigations' },
      { value: 'supervisors', label: 'Supervisors' },
    ]);
    mockGetWorkQueueByGroup
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([]); // after change

    render(<WorkQueueDashboard />);

    const select = screen.getByLabelText('Select queue');
    fireEvent.change(select, { target: { value: 'supervisors' } });

    await waitFor(() =>
      expect(mockGetWorkQueueByGroup).toHaveBeenCalledWith('supervisors'),
    );
  });

  it('assigns a task via modal and refreshes the list', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'UNASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() => screen.getByTestId('trigger-assign'));
    fireEvent.click(screen.getByTestId('trigger-assign'));

    expect(latestAssignModalProps.current?.open).toBe(true);

    await act(async () => {
      await latestAssignModalProps.current.onAssign(task, 'agent-2');
    });

    expect(mockAssignTask).toHaveBeenCalledWith('task-123', 'agent-2', {
      currentUserId: 'investigator-1',
      isInvestigator: true,
    });
    expect(mockGetWorkQueueByGroup).toHaveBeenCalledTimes(2);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Task Assigned Successfully',
      expect.stringContaining('task-123'),
    );
  });

  it('shows an error toast when assigning without assignee', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'UNASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup.mockResolvedValue([task]);

    render(<WorkQueueDashboard />);
    await waitFor(() => screen.getByTestId('trigger-assign'));
    fireEvent.click(screen.getByTestId('trigger-assign'));

    await act(async () => {
      await latestAssignModalProps.current.onAssign(task, undefined);
    });

    expect(mockAssignTask).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      'Assign Task Failed',
      'Missing assignee',
    );
  });

  it('updates task status and clears task param in URL', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'ASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockParams.taskId = 'task-123';
    mockGetWorkQueueByGroup
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() => screen.getByTestId('trigger-update-status'));
    fireEvent.click(screen.getByTestId('trigger-update-status'));

    await act(async () => {
      await latestUpdateStatusModalProps.current.onUpdateStatus(task, 'Assigned');
    });

    expect(mockUpdateTaskForSupervisor).toHaveBeenCalledWith('task-123', {
      status: 'STATUS_10_ASSIGNED',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/work-queue', {
      replace: true,
    });
  });

  it('requires reason when unassigning a task', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'ASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() => screen.getByTestId('trigger-unassign'));
    fireEvent.click(screen.getByTestId('trigger-unassign'));

    await act(async () => {
      await latestUnassignModalProps.current.onUnassign(task.id, 'No longer needed');
    });

    expect(mockUnassignTask).toHaveBeenCalledWith('task-123');
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Task Unassigned Successfully',
      expect.stringContaining('task-123'),
    );
  });

  it('reassigns a task when modal confirms', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'ASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() => screen.getByTestId('trigger-reassign'));
    fireEvent.click(screen.getByTestId('trigger-reassign'));

    await act(async () => {
      await latestReassignModalProps.current.onReassign(
        task,
        'agent-3',
        'Justification',
      );
    });

    expect(mockAssignTask).toHaveBeenCalledWith('task-123', 'agent-3', {
      currentUserId: 'investigator-1',
      isInvestigator: true,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Task Reassigned Successfully',
      expect.stringContaining('task-123'),
    );
  });

  it('opens assign modal automatically for deep-linked unassigned task', async () => {
    mockParams.taskId = 'task-123';
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'UNASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup.mockResolvedValue([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() => expect(latestAssignModalProps.current?.open).toBe(true));
  });

  it('completes a task and shows success toast', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'IN_PROGRESS',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup
      .mockResolvedValueOnce([task])
      .mockResolvedValueOnce([task]);

    render(<WorkQueueDashboard />);

    await waitFor(() => screen.getByTestId('trigger-complete'));
    fireEvent.click(screen.getByTestId('trigger-complete'));

    await act(async () => {
      await latestCompleteModalProps.current.onCompleteTask(task, 'Notes');
    });

    expect(mockCompleteTask).toHaveBeenCalledWith('task-123', { notes: '' });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Task Completed Successfully',
      expect.stringContaining('task-123'),
    );
  });

  it('handles assignment failures by showing error toast', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'UNASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup.mockResolvedValue([task]);
    mockAssignTask.mockRejectedValueOnce(new Error('boom'));

    render(<WorkQueueDashboard />);
    await waitFor(() => screen.getByTestId('trigger-assign'));
    fireEvent.click(screen.getByTestId('trigger-assign'));

    await act(async () => {
      await latestAssignModalProps.current.onAssign(task, 'agent-2');
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Assign Task Failed',
      'boom',
    );
  });

  it('validates missing status on update', async () => {
    const task = {
      id: 'task-123',
      taskId: 'task-123',
      name: 'Investigate',
      status: 'ASSIGNED',
      priority: 'NEW',
      createdAt: '2023-01-01T00:00:00.000Z',
      processInstanceId: 'proc-1',
    };
    mockGetWorkQueueByGroup.mockResolvedValue([task]);

    render(<WorkQueueDashboard />);
    await waitFor(() => screen.getByTestId('trigger-update-status'));
    fireEvent.click(screen.getByTestId('trigger-update-status'));

    await act(async () => {
      await latestUpdateStatusModalProps.current.onUpdateStatus(task, undefined);
    });

    expect(mockToastError).toHaveBeenCalledWith(
      'Update Task Status Failed',
      'Missing status',
    );
  });

  describe('Error handling', () => {
    it('handles error in loadWorkQueue and sets empty tasks array', async () => {
      const handleError = vi.fn();
      mockUseWorkQueueErrorHandler.mockReturnValue(
        createErrorHandler({ handleError }),
      );
      mockGetWorkQueueByGroup.mockRejectedValueOnce(new Error('Network error'));

      render(<WorkQueueDashboard />);

      await waitFor(() => {
        expect(handleError).toHaveBeenCalledWith(expect.any(Error));
      });
      // Verify empty state is shown
      await waitFor(() =>
        expect(
          screen.getByText(/No tasks found in Investigations/i),
        ).toBeInTheDocument(),
      );
    });

    it('handles retry button click in error display', async () => {
      const clearError = vi.fn();
      const handleError = vi.fn();
      const getErrorDisplay = vi.fn(() => ({
        message: 'Error loading',
        actionSuggestion: 'Try again',
        canRetry: true,
      }));
      mockUseWorkQueueErrorHandler.mockReturnValue(
        createErrorHandler({
          error: new Error('Failed'),
          clearError,
          handleError,
          getErrorDisplay,
        }),
      );
      mockGetWorkQueueByGroup
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce([
          {
            id: 'task-1',
            taskId: 'task-1',
            name: 'Test',
            status: 'ASSIGNED',
            priority: 'NEW',
            createdAt: '2023-01-01T00:00:00.000Z',
            processInstanceId: 'proc-1',
          },
        ]);

      render(<WorkQueueDashboard />);

      const retryButton = screen.getByRole('button', { name: /Retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(clearError).toHaveBeenCalled();
        expect(mockGetWorkQueueByGroup).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('URL-based task viewing', () => {
    it('opens update status modal for IN_PROGRESS task from URL', async () => {
      mockParams.taskId = 'task-123';
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'IN_PROGRESS',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);

      await waitFor(() => {
        expect(latestUpdateStatusModalProps.current?.open).toBe(true);
        expect(latestUpdateStatusModalProps.current?.task).toEqual(task);
      });
    });
  });

  describe('Search filtering', () => {
    it('filters tasks by task ID', async () => {
      const tasks = [
        {
          id: 'task-123',
          taskId: 'task-123',
          name: 'Task One',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-1',
        },
        {
          id: 'task-456',
          taskId: 'task-456',
          name: 'Task Two',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-2',
        },
      ];
      mockGetWorkQueueByGroup.mockResolvedValue(tasks);

      render(<WorkQueueDashboard />);

      await waitFor(() => screen.getByTestId('workqueue-table'));

      const searchInput = screen.getByPlaceholderText(
        /Search tasks, cases, descriptions/i,
      );
      fireEvent.change(searchInput, { target: { value: 'task-123' } });

      await waitFor(() => {
        expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
          'task-123',
        );
        expect(screen.getByTestId('workqueue-table')).not.toHaveTextContent(
          'task-456',
        );
      });
    });

    it('filters tasks by task name', async () => {
      const tasks = [
        {
          id: 'task-1',
          taskId: 'task-1',
          name: 'Investigate Alert',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-1',
        },
        {
          id: 'task-2',
          taskId: 'task-2',
          name: 'Review Case',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-2',
        },
      ];
      mockGetWorkQueueByGroup.mockResolvedValue(tasks);

      render(<WorkQueueDashboard />);

      await waitFor(() => screen.getByTestId('workqueue-table'));

      const searchInput = screen.getByPlaceholderText(
        /Search tasks, cases, descriptions/i,
      );
      fireEvent.change(searchInput, { target: { value: 'Investigate' } });

      await waitFor(() => {
        expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
          'task-1',
        );
        expect(screen.getByTestId('workqueue-table')).not.toHaveTextContent(
          'task-2',
        );
      });
    });

    it('filters tasks by description', async () => {
      const tasks = [
        {
          id: 'task-1',
          taskId: 'task-1',
          name: 'Task One',
          description: 'This is a test description',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-1',
        },
        {
          id: 'task-2',
          taskId: 'task-2',
          name: 'Task Two',
          description: 'Another description',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-2',
        },
      ];
      mockGetWorkQueueByGroup.mockResolvedValue(tasks);

      render(<WorkQueueDashboard />);

      await waitFor(() => screen.getByTestId('workqueue-table'));

      const searchInput = screen.getByPlaceholderText(
        /Search tasks, cases, descriptions/i,
      );
      fireEvent.change(searchInput, { target: { value: 'test description' } });

      await waitFor(() => {
        expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
          'task-1',
        );
        expect(screen.getByTestId('workqueue-table')).not.toHaveTextContent(
          'task-2',
        );
      });
    });

    it('filters tasks by candidate group', async () => {
      const tasks = [
        {
          id: 'task-1',
          taskId: 'task-1',
          name: 'Task One',
          candidateGroup: 'Investigations',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-1',
        },
        {
          id: 'task-2',
          taskId: 'task-2',
          name: 'Task Two',
          candidateGroup: 'Supervision',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-2',
        },
      ];
      mockGetWorkQueueByGroup.mockResolvedValue(tasks);

      render(<WorkQueueDashboard />);

      await waitFor(() => screen.getByTestId('workqueue-table'));

      const searchInput = screen.getByPlaceholderText(
        /Search tasks, cases, descriptions/i,
      );
      fireEvent.change(searchInput, { target: { value: 'Investigations' } });

      await waitFor(() => {
        expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
          'task-1',
        );
        expect(screen.getByTestId('workqueue-table')).not.toHaveTextContent(
          'task-2',
        );
      });
    });

    it('filters tasks by case ID', async () => {
      const tasks = [
        {
          id: 'task-1',
          taskId: 'task-1',
          name: 'Task One',
          caseId: 'CASE-123',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-1',
        },
        {
          id: 'task-2',
          taskId: 'task-2',
          name: 'Task Two',
          caseId: 'CASE-456',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-2',
        },
      ];
      mockGetWorkQueueByGroup.mockResolvedValue(tasks);

      render(<WorkQueueDashboard />);

      await waitFor(() => screen.getByTestId('workqueue-table'));

      const searchInput = screen.getByPlaceholderText(
        /Search tasks, cases, descriptions/i,
      );
      fireEvent.change(searchInput, { target: { value: 'CASE-123' } });

      await waitFor(() => {
        expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
          'task-1',
        );
        expect(screen.getByTestId('workqueue-table')).not.toHaveTextContent(
          'task-2',
        );
      });
    });

    it('performs case-insensitive search', async () => {
      const tasks = [
        {
          id: 'task-1',
          taskId: 'task-1',
          name: 'Investigate Alert',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-1',
        },
        {
          id: 'task-2',
          taskId: 'task-2',
          name: 'Review Case',
          status: 'ASSIGNED',
          priority: 'NEW',
          createdAt: '2023-01-01T00:00:00.000Z',
          processInstanceId: 'proc-2',
        },
      ];
      mockGetWorkQueueByGroup.mockResolvedValue(tasks);

      render(<WorkQueueDashboard />);

      await waitFor(() => screen.getByTestId('workqueue-table'));

      const searchInput = screen.getByPlaceholderText(
        /Search tasks, cases, descriptions/i,
      );
      // Search with lowercase
      fireEvent.change(searchInput, { target: { value: 'investigate' } });

      await waitFor(() => {
        expect(screen.getByTestId('workqueue-table')).toHaveTextContent(
          'task-1',
        );
        expect(screen.getByTestId('workqueue-table')).not.toHaveTextContent(
          'task-2',
        );
      });
    });
  });

  describe('Task operation validation', () => {
    it('validates missing reason on unassign', async () => {
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'ASSIGNED',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);
      await waitFor(() => screen.getByTestId('trigger-unassign'));
      fireEvent.click(screen.getByTestId('trigger-unassign'));

      await act(async () => {
        await latestUnassignModalProps.current.onUnassign(task.id, '');
      });

      expect(mockToastError).toHaveBeenCalledWith(
        'Unassign Task Failed',
        'Missing reason',
      );
      expect(mockUnassignTask).not.toHaveBeenCalled();
    });
  });

  describe('Modal close handlers', () => {
    it('clears URL params when closing AssignTaskModal', async () => {
      mockParams.taskId = 'task-123';
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'UNASSIGNED',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);

      await waitFor(() => {
        expect(latestAssignModalProps.current?.open).toBe(true);
      });

      // Close the modal
      act(() => {
        latestAssignModalProps.current.onClose();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/work-queue');
      await waitFor(() => {
        expect(latestAssignModalProps.current?.open).toBe(false);
      });
    });

    it('clears URL params when closing ReassignTaskModal', async () => {
      mockParams.taskId = 'task-123';
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'ASSIGNED',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);
      await waitFor(() => screen.getByTestId('trigger-reassign'));
      fireEvent.click(screen.getByTestId('trigger-reassign'));

      await waitFor(() => {
        expect(latestReassignModalProps.current?.open).toBe(true);
      });

      // Close the modal
      act(() => {
        latestReassignModalProps.current.onClose();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/work-queue');
      await waitFor(() => {
        expect(latestReassignModalProps.current?.open).toBe(false);
      });
    });

    it('clears URL params when closing UnassignTaskModal', async () => {
      mockParams.taskId = 'task-123';
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'ASSIGNED',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);
      await waitFor(() => screen.getByTestId('trigger-unassign'));
      fireEvent.click(screen.getByTestId('trigger-unassign'));

      await waitFor(() => {
        expect(latestUnassignModalProps.current?.open).toBe(true);
      });

      // Close the modal
      act(() => {
        latestUnassignModalProps.current.onClose();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/work-queue');
      await waitFor(() => {
        expect(latestUnassignModalProps.current?.open).toBe(false);
      });
    });

    it('clears URL params when closing CompleteTaskModal', async () => {
      mockParams.taskId = 'task-123';
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'IN_PROGRESS',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);
      await waitFor(() => screen.getByTestId('trigger-complete'));
      fireEvent.click(screen.getByTestId('trigger-complete'));

      await waitFor(() => {
        expect(latestCompleteModalProps.current?.open).toBe(true);
      });

      // Close the modal
      act(() => {
        latestCompleteModalProps.current.onClose();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/work-queue');
      await waitFor(() => {
        expect(latestCompleteModalProps.current?.open).toBe(false);
      });
    });

    it('clears URL params when closing UpdateTaskStatusModal', async () => {
      mockParams.taskId = 'task-123';
      const task = {
        id: 'task-123',
        taskId: 'task-123',
        name: 'Investigate',
        status: 'ASSIGNED',
        priority: 'NEW',
        createdAt: '2023-01-01T00:00:00.000Z',
        processInstanceId: 'proc-1',
      };
      mockGetWorkQueueByGroup.mockResolvedValue([task]);

      render(<WorkQueueDashboard />);
      await waitFor(() => screen.getByTestId('trigger-update-status'));
      fireEvent.click(screen.getByTestId('trigger-update-status'));

      await waitFor(() => {
        expect(latestUpdateStatusModalProps.current?.open).toBe(true);
      });

      // Close the modal
      act(() => {
        latestUpdateStatusModalProps.current.onClose();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/work-queue');
      await waitFor(() => {
        expect(latestUpdateStatusModalProps.current?.open).toBe(false);
      });
    });
  });
});

