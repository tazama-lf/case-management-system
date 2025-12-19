import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseHistoryTab from '../CaseHistoryTab';
import { caseService } from '../../../services/caseService';
import { taskService } from '../../../services/taskService';
import authService from '@/features/auth/services/authService';
import type { CaseRow } from '../../casesTable.utils';

vi.mock('../../../services/caseService');
vi.mock('../../../services/taskService');
vi.mock('@/features/auth/services/authService');

const mockCaseRow: CaseRow = {
  id: 'CASE-123',
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_20_IN_PROGRESS',
  statusColor: 'bg-blue-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  action: 'View',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
};

describe('CaseHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue([
      { id: 'user-1', firstName: 'John', lastName: 'Doe', username: 'jdoe' },
    ]);
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<CaseHistoryTab caseId="CASE-123" />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays case timeline after loading', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-1',
    };
    const mockTasks: any[] = [];
    const mockHistory: any[] = [];

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue(mockHistory);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    });
  });

  it('fetches case details, tasks, and history on mount', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-1',
    };
    const mockTasks: any[] = [];
    const mockHistory: any[] = [];

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue(mockHistory);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith('CASE-123');
      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith('CASE-123');
      expect(caseService.getCaseHistory).toHaveBeenCalledWith('CASE-123');
    });
  });

  it('displays case creation event', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-1',
    };
    const mockTasks: any[] = [];
    const mockHistory: any[] = [];

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue(mockHistory);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Case submitted for approval/i)).toBeInTheDocument();
    });
  });

  it('displays task events', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-1',
    };
    const mockTasks = [
      {
        task_id: 'TASK-1',
        name: 'Investigate Case',
        description: 'Investigate',
        status: 'STATUS_30_COMPLETED',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-03T00:00:00Z',
        assigned_user_id: 'user-1',
        assignedUser: { username: 'jdoe' },
      },
    ];
    const mockHistory: any[] = [];

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue(mockHistory);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Investigation completed/i)).toBeInTheDocument();
    });
  });

  it('displays audit log events', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-1',
    };
    const mockTasks: any[] = [];
    const mockHistory = [
      {
        id: '1',
        operation: 'addComment',
        action_performed: 'Comment added to case',
        performed_at: '2023-01-02T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
        outcome: 'success',
      },
    ];

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue(mockHistory);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      // Check that audit log event is present (may appear multiple times due to case creation event)
      const commentEvents = screen.getAllByText(/Comment added/i);
      expect(commentEvents.length).toBeGreaterThan(0);
    });
  });

  it('displays case timeline even with minimal events', async () => {
    const mockCase = {
      case_id: 'CASE-123',
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      case_creator_user_id: 'user-1',
      case_owner_user_id: 'user-1',
    };
    const mockTasks: any[] = [];
    const mockHistory: any[] = [];

    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue(mockHistory);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      // Component always creates at least a case creation event
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
      expect(screen.getByText(/Case submitted for approval/i)).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Failed to fetch');
    (caseService.getCaseDetails as vi.Mock).mockRejectedValue(error);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);
    (caseService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId="CASE-123" />);

    await waitFor(() => {
      // Component should still render, even if some data fails to load
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

