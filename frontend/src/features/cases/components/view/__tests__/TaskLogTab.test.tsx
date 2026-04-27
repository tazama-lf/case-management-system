import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TaskLogTab from '../TaskLogTab';
import { taskService } from '../../../services/taskService';
import { caseService } from '../../../services/caseService';
import authService from '@/features/auth/services/authService';
import { useToast } from '@/shared/providers/ToastProvider';
import { useAuth } from '@/features/auth/components/AuthContext';

vi.mock('../../../services/taskService');
vi.mock('../../../services/caseService');
vi.mock('@/features/auth/services/authService');
vi.mock('../CaseDetailTaskLogTable', () => ({
  default: ({
    tasks,
    onAssign,
    onReassign,
    onUnassign,
    onTaskClick,
    onUpdateStatus,
    onComplete,
    onRefreshCases,
  }: any) => (
    <div data-testid="task-log-table">
      {tasks?.length > 0 ? (
        tasks.map((t: any) => (
          <div key={t.id || t.taskId}>
            <span>{t.name}</span>
            <span data-testid={`status-${t.id}`}>{t.status}</span>
            {onAssign && (
              <button
                data-testid={`assign-${t.id}`}
                onClick={() => onAssign(t)}
              >
                Assign
              </button>
            )}
            {onReassign && (
              <button
                data-testid={`reassign-${t.id}`}
                onClick={() => onReassign(t)}
              >
                Reassign
              </button>
            )}
            {onUnassign && (
              <button
                data-testid={`unassign-${t.id}`}
                onClick={() => onUnassign(t)}
              >
                Unassign
              </button>
            )}
            {onTaskClick && (
              <button
                data-testid={`view-${t.id}`}
                onClick={() => onTaskClick(t)}
              >
                View
              </button>
            )}
            {onUpdateStatus && (
              <button
                data-testid={`update-${t.id}`}
                onClick={() => onUpdateStatus(t)}
              >
                Update
              </button>
            )}
            {onComplete && (
              <button
                data-testid={`complete-${t.id}`}
                onClick={() => onComplete(t)}
              >
                Complete
              </button>
            )}
            {onRefreshCases && (
              <button
                data-testid={`table-refresh-${t.id}`}
                onClick={onRefreshCases}
              >
                Table Refresh
              </button>
            )}
          </div>
        ))
      ) : (
        <div>No tasks found for this case</div>
      )}
    </div>
  ),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: vi.fn(),
}));
vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  })),
}));
vi.mock('../../modals/AssignTaskModal', () => ({
  default: ({ open, onAssign, onClose }: any) =>
    open ? (
      <div data-testid="assign-modal">
        <button onClick={() => onAssign({ id: 1 }, 'user-2')}>
          Confirm Assign
        </button>
        <button onClick={onClose}>Close Assign</button>
      </div>
    ) : null,
}));
vi.mock('../../modals/ReassignTaskModal', () => ({
  default: ({ open, onReassign, onClose }: any) =>
    open ? (
      <div data-testid="reassign-modal">
        <button onClick={() => onReassign({ id: 1 }, 'user-2', 'reason')}>
          Confirm Reassign
        </button>
        <button onClick={onClose}>Close Reassign</button>
      </div>
    ) : null,
}));
vi.mock('../../modals/UnassignTaskModal', () => ({
  default: ({ open, onUnassign, onClose }: any) =>
    open ? (
      <div data-testid="unassign-modal">
        <button onClick={() => onUnassign(1, 'reason')}>
          Confirm Unassign
        </button>
        <button onClick={onClose}>Close Unassign</button>
      </div>
    ) : null,
}));
vi.mock('../../modals/UpdateTaskStatusModal', () => ({
  default: ({ open, onUpdateStatus, task, onClose }: any) =>
    open ? (
      <div data-testid="update-status-modal">
        <button
          onClick={() => onUpdateStatus(task || { id: 1 }, 'In Progress')}
        >
          Confirm Update Status
        </button>
        <button onClick={onClose}>Close Update</button>
      </div>
    ) : null,
}));
vi.mock('../../modals/CompleteTaskModal', () => ({
  default: ({ open, onCompleteTask, task, onClose }: any) =>
    open ? (
      <div data-testid="complete-modal">
        <button
          onClick={() =>
            onCompleteTask(task || { id: 1 }, 'final notes', 'Fraud Confirmed')
          }
        >
          Confirm Complete
        </button>
        <button onClick={onClose}>Close Complete</button>
      </div>
    ) : null,
}));
vi.mock('../../TasksDetailsModal', () => ({
  default: ({ open, onClose, onTaskUpdate }: any) =>
    open ? (
      <div data-testid="task-details-modal">
        <button onClick={onClose}>Close Details</button>
        {onTaskUpdate && (
          <button data-testid="trigger-task-update" onClick={onTaskUpdate}>
            Trigger Task Update
          </button>
        )}
      </div>
    ) : null,
}));
vi.mock('../../modals/SarStrFilingModal', () => ({
  default: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="sar-str-modal">
        <button onClick={onClose}>Close SAR</button>
      </div>
    ) : null,
}));

describe('TaskLogTab', () => {
  const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    );
  };

  const mockTasks = [
    {
      task_id: 1,
      name: 'Investigate Case',
      description: 'Investigate the case',
      status: 'STATUS_20_IN_PROGRESS',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_id: 123,
      assigned_user_id: 'user-1',
      candidateGroup: 'investigations',
    },
  ];

  const mockInvestigators = [
    { id: 'user-1', firstName: 'John', lastName: 'Doe', username: 'jdoe' },
  ];

  const mockSuccess = vi.fn();
  const mockError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as vi.Mock).mockReturnValue({
      success: mockSuccess,
      error: mockError,
    });
    (useAuth as vi.Mock).mockReturnValue({
      hasSupervisorRole: () => true,
      hasCMSAdminRole: () => false,
      hasComplianceOfficerRole: () => false,
      hasInvestigatorRole: () => false,
      hasAdminRole: () => false,
      hasAnyRole: () => false,
      hasAllRoles: () => false,
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getUserCases as vi.Mock).mockResolvedValue({
      cases: [
        {
          case_id: 123,
          case_type: 'FRAUD',
          status: 'STATUS_20_IN_PROGRESS',
          priority: 'HIGH',
          tasks: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
          case_creator_user_id: 'user-1',
          case_owner_user_id: 'user-1',
        },
      ],
      total: 1,
    });
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue(
      mockInvestigators,
    );
  });

  it('renders task log tab', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search tasks...'),
      ).toBeInTheDocument();
    });
  });

  it('displays loading state initially', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockImplementation(
      () => new Promise(() => { }),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
  });

  it('fetches tasks on mount', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith(123);
    });
  });

  it('displays tasks in table', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
  });

  it('allows searching tasks', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search tasks...'),
      ).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'Investigate' } });
    expect(searchInput).toHaveValue('Investigate');
  });

  it('allows filtering by status', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      const statusFilter = screen.getByRole('combobox');
      expect(statusFilter).toBeInTheDocument();
      fireEvent.change(statusFilter, {
        target: { value: 'STATUS_20_IN_PROGRESS' },
      });
      expect(statusFilter).toHaveValue('STATUS_20_IN_PROGRESS');
    });
  });

  it('displays empty state when no tasks', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByText(/No tasks found for this case/i),
      ).toBeInTheDocument();
    });
  });

  it('handles errors when fetching tasks fails', async () => {
    const error = new Error('Failed to fetch');
    (taskService.getTasksByCaseId as vi.Mock).mockRejectedValue(error);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Error loading tasks/i)).toBeInTheDocument();
    });
  });

  it('opens assign modal when assign button is clicked', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('assign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
    });
  });

  it('opens reassign modal when reassign button is clicked', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('reassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('reassign-modal')).toBeInTheDocument();
    });
  });

  it('opens unassign modal when unassign button is clicked', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('unassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('unassign-modal')).toBeInTheDocument();
    });
  });

  it('opens task details modal when view button is clicked', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('view-1'));
    await waitFor(() => {
      expect(screen.getByTestId('task-details-modal')).toBeInTheDocument();
    });
  });

  it('maps task status correctly - UNASSIGNED', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      {
        ...mockTasks[0],
        status: 'STATUS_01_UNASSIGNED',
        assigned_user_id: null,
      },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-1')).toHaveTextContent('UNASSIGNED');
    });
  });

  it('maps task status correctly - ASSIGNED', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], status: 'STATUS_10_ASSIGNED' },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-1')).toHaveTextContent('ASSIGNED');
    });
  });

  it('maps task status correctly - COMPLETED', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], status: 'STATUS_30_COMPLETED' },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-1')).toHaveTextContent('COMPLETED');
    });
  });

  it('maps task status correctly - BLOCKED', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], status: 'STATUS_21_BLOCKED' },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-1')).toHaveTextContent('SUSPENDED');
    });
  });

  it('hides supervisor tasks for investigators', async () => {
    (useAuth as vi.Mock).mockReturnValue({
      hasSupervisorRole: () => false,
      hasCMSAdminRole: () => false,
      hasComplianceOfficerRole: () => false,
      hasInvestigatorRole: () => true,
      hasAdminRole: () => false,
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0] },
      {
        task_id: 2,
        name: 'Approve Case Creation',
        status: 'STATUS_10_ASSIGNED',
        case_id: 123,
        assigned_user_id: 'sup-1',
        candidateGroup: 'supervisors',
        created_at: '2023-01-01',
      },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    // Supervisor tasks should be filtered out
    expect(screen.queryByText('Approve Case Creation')).not.toBeInTheDocument();
  });

  it('treats assigned status without user as unassigned', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], status: 'STATUS_10_ASSIGNED', assigned_user_id: null },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-1')).toHaveTextContent('UNASSIGNED');
    });
  });

  it('falls back to getCaseDetails when case not found in getUserCases', async () => {
    (caseService.getUserCases as vi.Mock).mockResolvedValue({
      cases: [],
      total: 0,
    });
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      case_id: 123,
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
    });
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith(123);
    });
  });

  it('handles investigator fetch failure gracefully', async () => {
    (authService.fetchAllInvestigators as vi.Mock).mockRejectedValue(
      new Error('Failed'),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
  });

  it('shows status filter options', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      const statusFilter = screen.getByRole('combobox');
      expect(statusFilter).toBeInTheDocument();
    });
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(6); // All + 5 statuses
  });

  it('shows no match message when search has no results', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'zzz_nonexistent_zzz' } });
    await waitFor(() => {
      expect(
        screen.getByText(/No tasks match your search criteria/i),
      ).toBeInTheDocument();
    });
  });

  it('assigns task via modal confirm action', async () => {
    (taskService.assignTaskToInvestigator as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('assign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Assign'));
    await waitFor(() => {
      expect(taskService.assignTaskToInvestigator).toHaveBeenCalled();
    });
  });

  it('reassigns task via modal confirm action', async () => {
    (taskService.reassignTask as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('reassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('reassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Reassign'));
    await waitFor(() => {
      expect(taskService.reassignTask).toHaveBeenCalled();
    });
  });

  it('unassigns task via modal confirm action', async () => {
    (taskService.unassignTask as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('unassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('unassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Unassign'));
    await waitFor(() => {
      expect(taskService.unassignTask).toHaveBeenCalled();
    });
  });

  it('handles assign task error', async () => {
    (taskService.assignTaskToInvestigator as vi.Mock).mockRejectedValue(
      new Error('Assign failed'),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('assign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Assign'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });

  it('handles reassign task error', async () => {
    (taskService.reassignTask as vi.Mock).mockRejectedValue(
      new Error('Reassign failed'),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('reassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('reassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Reassign'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });

  it('closes assign modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('assign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Assign'));
    await waitFor(() => {
      expect(screen.queryByTestId('assign-modal')).not.toBeInTheDocument();
    });
  });

  it('closes reassign modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('reassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('reassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Reassign'));
    await waitFor(() => {
      expect(screen.queryByTestId('reassign-modal')).not.toBeInTheDocument();
    });
  });

  it('closes unassign modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('unassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('unassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Unassign'));
    await waitFor(() => {
      expect(screen.queryByTestId('unassign-modal')).not.toBeInTheDocument();
    });
  });

  it('opens SAR/STR filing modal for compliance officer viewing SAR task', async () => {
    (useAuth as vi.Mock).mockReturnValue({
      hasSupervisorRole: () => false,
      hasCMSAdminRole: () => false,
      hasComplianceOfficerRole: () => true,
      hasInvestigatorRole: () => false,
      hasAdminRole: () => false,
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      {
        ...mockTasks[0],
        task_id: 1,
        name: 'SAR/STR Filing',
        status: 'STATUS_20_IN_PROGRESS',
        candidateGroup: 'compliance',
      },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('view-1'));
    await waitFor(() => {
      expect(screen.getByTestId('sar-str-modal')).toBeInTheDocument();
    });
  });

  it('opens update status modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('update-1'));
    await waitFor(() => {
      expect(screen.getByTestId('update-status-modal')).toBeInTheDocument();
    });
  });

  it('closes update status modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('update-1'));
    await waitFor(() => {
      expect(screen.getByTestId('update-status-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Update'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('update-status-modal'),
      ).not.toBeInTheDocument();
    });
  });

  it('closes task details modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('view-1'));
    await waitFor(() => {
      expect(screen.getByTestId('task-details-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Details'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('task-details-modal'),
      ).not.toBeInTheDocument();
    });
  });

  it('resolves investigator names from fetchAllInvestigators', async () => {
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue([
      { id: 'user-1', firstName: 'John', lastName: 'Doe', username: 'jdoe' },
    ]);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], assigned_user_id: 'user-1' },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(authService.fetchAllInvestigators).toHaveBeenCalled();
    });
  });

  it('filters tasks by status', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], task_id: 1, status: 'STATUS_20_IN_PROGRESS' },
      {
        task_id: 2,
        name: 'Review Alert',
        status: 'STATUS_30_COMPLETED',
        case_id: 123,
        assigned_user_id: 'user-1',
        candidateGroup: 'investigations',
        created_at: '2023-01-01',
      },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    const statusFilter = screen.getByRole('combobox');
    fireEvent.change(statusFilter, {
      target: { value: 'STATUS_30_COMPLETED' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Investigate Case')).not.toBeInTheDocument();
    });
  });

  it('handles complete task operation', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('complete-1'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Complete'));
    await waitFor(() => {
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'STATUS_30_COMPLETED' }),
      );
    });
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Task Completed Successfully',
        expect.stringContaining('completed successfully'),
      );
    });
  });

  it('renders no tasks when empty with no visible tasks', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByText(/No tasks found for this case/i),
      ).toBeInTheDocument();
    });
  });

  it('onAfterTaskReassign called for investigator-only users', async () => {
    const onAfterTaskReassign = vi.fn();
    (useAuth as vi.Mock).mockReturnValue({
      hasSupervisorRole: () => false,
      hasCMSAdminRole: () => false,
      hasComplianceOfficerRole: () => false,
      hasInvestigatorRole: () => true,
      hasAdminRole: () => false,
    });
    (taskService.reassignTask as vi.Mock).mockResolvedValue({});
    renderWithProviders(
      <TaskLogTab caseId={123} onAfterTaskReassign={onAfterTaskReassign} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('reassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('reassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Reassign'));
    await waitFor(() => {
      expect(taskService.reassignTask).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onAfterTaskReassign).toHaveBeenCalled();
    });
  });

  it('handles unassign task error', async () => {
    (taskService.unassignTask as vi.Mock).mockRejectedValue(
      new Error('Unassign failed'),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('unassign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('unassign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Unassign'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });

  it('success toast shown after successful assign', async () => {
    (taskService.assignTaskToInvestigator as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('assign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Assign'));
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it('updates task status via modal confirm', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('update-1'));
    await waitFor(() => {
      expect(screen.getByTestId('update-status-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Update Status'));
    await waitFor(() => {
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalled();
    });
  });

  it('shows success toast after updating status', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('update-1'));
    await waitFor(() => {
      expect(screen.getByTestId('update-status-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Update Status'));
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it('completes task via complete modal', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('complete-1'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Complete'));
    await waitFor(() => {
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it('handles complete task error', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockRejectedValue(
      new Error('Complete failed'),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('complete-1'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Complete'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });

  it('closes complete modal', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('complete-1'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Complete'));
    await waitFor(() => {
      expect(screen.queryByTestId('complete-modal')).not.toBeInTheDocument();
    });
  });

  it('calls onRefreshCases after successful assign', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    (taskService.assignTaskToInvestigator as vi.Mock).mockResolvedValue({});
    renderWithProviders(
      <TaskLogTab caseId={123} onRefreshCases={mockRefresh} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('assign-1'));
    await waitFor(() => {
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Assign'));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('triggers task refresh from task details onTaskUpdate', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <TaskLogTab caseId={123} onRefreshCases={mockRefresh} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('view-1'));
    await waitFor(() => {
      expect(screen.getByTestId('task-details-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('trigger-task-update'));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('closes SarStr modal and refreshes tasks', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    (useAuth as vi.Mock).mockReturnValue({
      hasSupervisorRole: () => true,
      hasCMSAdminRole: () => false,
      hasComplianceOfficerRole: () => true,
      hasInvestigatorRole: () => false,
      hasAdminRole: () => false,
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      {
        ...mockTasks[0],
        task_id: 1,
        name: 'SAR/STR Filing',
        status: 'STATUS_20_IN_PROGRESS',
        candidateGroup: 'compliance',
      },
    ]);
    renderWithProviders(
      <TaskLogTab caseId={123} onRefreshCases={mockRefresh} />,
    );
    await waitFor(() => {
      expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('view-1'));
    await waitFor(() => {
      expect(screen.getByTestId('sar-str-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close SAR'));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('maps unknown status to UNASSIGNED by default', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0], status: 'UNKNOWN_STATUS' },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByTestId('status-1')).toHaveTextContent('UNASSIGNED');
    });
  });

  it('hides additional supervisor task patterns for investigators', async () => {
    (useAuth as vi.Mock).mockReturnValue({
      hasSupervisorRole: () => false,
      hasCMSAdminRole: () => false,
      hasComplianceOfficerRole: () => false,
      hasInvestigatorRole: () => true,
      hasAdminRole: () => false,
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0] },
      {
        task_id: 3,
        name: 'Approve Case Reopening',
        status: 'STATUS_10_ASSIGNED',
        case_id: 123,
        candidateGroup: 'investigations',
        created_at: '2023-01-01',
      },
      {
        task_id: 4,
        name: 'Review Case Closure',
        status: 'STATUS_10_ASSIGNED',
        case_id: 123,
        candidateGroup: 'investigations',
        created_at: '2023-01-01',
      },
      {
        task_id: 5,
        name: 'Supervisor Review',
        status: 'STATUS_10_ASSIGNED',
        case_id: 123,
        candidateGroup: 'investigations',
        created_at: '2023-01-01',
      },
      {
        task_id: 6,
        name: 'Final Approval',
        status: 'STATUS_10_ASSIGNED',
        case_id: 123,
        candidateGroup: 'investigations',
        created_at: '2023-01-01',
      },
    ]);
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Approve Case Reopening'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Review Case Closure')).not.toBeInTheDocument();
    expect(screen.queryByText('Supervisor Review')).not.toBeInTheDocument();
    expect(screen.queryByText('Final Approval')).not.toBeInTheDocument();
  });

  it('calls onRefreshCases after successful complete', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    renderWithProviders(
      <TaskLogTab caseId={123} onRefreshCases={mockRefresh} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('complete-1'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Complete'));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('handles update status error', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockRejectedValue(
      new Error('Update failed'),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('update-1'));
    await waitFor(() => {
      expect(screen.getByTestId('update-status-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Update Status'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });

  it('calls onRefreshCases via table refresh callback', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <TaskLogTab caseId={123} onRefreshCases={mockRefresh} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('table-refresh-1'));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
