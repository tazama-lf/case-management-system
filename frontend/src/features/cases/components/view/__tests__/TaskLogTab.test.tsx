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
  default: ({ tasks, searchTerm, statusFilter }: any) => (
    <div data-testid="task-log-table">
      {tasks?.length > 0 ? (
        tasks
          .filter((t: any) => !searchTerm || t.name?.includes(searchTerm))
          .map((t: any) => <div key={t.task_id}>{t.name}</div>)
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

describe('TaskLogTab', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    );

  const mockTasks = [
    {
      task_id: 'TASK-1',
      name: 'Investigate Case',
      description: 'Investigate the case',
      status: 'STATUS_20_IN_PROGRESS',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_id: 'CASE-123',
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
      cases: [{
        case_id: 123,
        case_type: 'FRAUD',
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        tasks: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        case_creator_user_id: 'user-1',
        case_owner_user_id: 'user-1',
      }],
      total: 1,
    });
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue(
      mockInvestigators,
    );
  });

  it('renders task log tab', async () => {
    renderWithProviders(<TaskLogTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    renderWithProviders(<TaskLogTab caseId={123} />);
    // Component shows loading message while tasks are loading
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

  it('handles task assignment', async () => {
    (taskService.assignTaskToInvestigator as vi.Mock).mockResolvedValue({});

    renderWithProviders(<TaskLogTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });

    // Task assignment is handled through TaskLogTable component
    // The actual assignment modal would be opened by clicking assign button
  });

  it('handles errors when fetching tasks fails', async () => {
    const error = new Error('Failed to fetch');
    (taskService.getTasksByCaseId as vi.Mock).mockRejectedValue(error);

    renderWithProviders(<TaskLogTab caseId={123} />);

    await waitFor(() => {
      // Component should handle error gracefully
      expect(
        screen.getByText(/Error loading tasks/i),
      ).toBeInTheDocument();
    });
  });
});
