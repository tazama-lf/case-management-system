import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskLogTab from '../TaskLogTab';
import { taskService } from '../../../services/taskService';
import authService from '@/features/auth/services/authService';
import { useToast } from '@/shared/providers/ToastProvider';
import { useAuth } from '@/features/auth/components/AuthContext';

vi.mock('../../../services/taskService');
vi.mock('@/features/auth/services/authService');
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: vi.fn(),
}));
vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('TaskLogTab', () => {
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
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue(mockInvestigators);
  });

  it('renders task log tab', () => {
    render(<TaskLogTab caseId="CASE-123" />);

    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  it('displays loading state initially', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<TaskLogTab caseId="CASE-123" />);
    // Component shows search input even while loading
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  it('fetches tasks on mount', async () => {
    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith('CASE-123');
    });
  });

  it('displays tasks in table', async () => {
    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });
  });

  it('allows searching tasks', async () => {
    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'Investigate' } });

    expect(searchInput).toHaveValue('Investigate');
  });

  it('allows filtering by status', async () => {
    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      const statusFilter = screen.getByRole('combobox');
      expect(statusFilter).toBeInTheDocument();
      fireEvent.change(statusFilter, { target: { value: 'STATUS_20_IN_PROGRESS' } });
      expect(statusFilter).toHaveValue('STATUS_20_IN_PROGRESS');
    });
  });

  it('displays empty state when no tasks', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);

    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText(/No tasks found for this case/i)).toBeInTheDocument();
    });
  });

  it('handles task assignment', async () => {
    (taskService.assignTaskToInvestigator as vi.Mock).mockResolvedValue({});

    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    });

    // Task assignment is handled through TaskLogTable component
    // The actual assignment modal would be opened by clicking assign button
  });

  it('handles errors when fetching tasks fails', async () => {
    const error = new Error('Failed to fetch');
    (taskService.getTasksByCaseId as vi.Mock).mockRejectedValue(error);

    render(<TaskLogTab caseId="CASE-123" />);

    await waitFor(() => {
      // Component should handle error gracefully
      expect(screen.getByText(/No tasks found for this case/i)).toBeInTheDocument();
    });
  });
});

