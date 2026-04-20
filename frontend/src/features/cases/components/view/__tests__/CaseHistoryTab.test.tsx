import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseHistoryTab from '../CaseHistoryTab';
import { caseHistoryService } from '../../../services/caseHistoryService';
import { taskHistoryService } from '../../../services/taskHistoryService';
import authService from '@/features/auth/services/authService';
import type { CaseRow } from '../../casesTable.utils';

vi.mock('../../../services/caseHistoryService');
vi.mock('../../../services/taskHistoryService');
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
    (caseHistoryService.getCaseHistory as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    (taskHistoryService.getCaseHistory as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<CaseHistoryTab caseId={123} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays case timeline after loading', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    });
  });

  it('fetches case history and task history on mount', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(caseHistoryService.getCaseHistory).toHaveBeenCalledWith(123);
      expect(taskHistoryService.getCaseHistory).toHaveBeenCalledWith(123);
    });
  });

  it('displays case creation event', async () => {
    const mockCaseHistory = [
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'createCase',
        entity_name: 'User',
        action_performed: 'Case submitted for approval',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ];

    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue(mockCaseHistory);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Case submitted for approval/i),
      ).toBeInTheDocument();
    });
  });

  it('displays task events', async () => {
    const mockTaskHistory = [
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'completeTask',
        entity_name: 'User',
        action_performed: 'Investigation completed',
        case_id: 123,
        performed_at: '2023-01-03T00:00:00Z',
        task_id: 1,
      },
    ];

    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue(mockTaskHistory);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText(/Investigation completed/i)).toBeInTheDocument();
    });
  });

  it('displays audit log events', async () => {
    const mockCaseHistory = [
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'addComment',
        entity_name: 'User',
        action_performed: 'Comment added to case',
        case_id: 123,
        performed_at: '2023-01-02T00:00:00Z',
      },
    ];

    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue(mockCaseHistory);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(() => {
      const commentEvents = screen.getAllByText(/Comment added/i);
      expect(commentEvents.length).toBeGreaterThan(0);
    });
  });

  it('displays case timeline even with minimal events', async () => {
    const mockCaseHistory = [
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'createCase',
        entity_name: 'User',
        action_performed: 'Case submitted for approval',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ];

    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue(mockCaseHistory);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
      expect(
        screen.getByText(/Case submitted for approval/i),
      ).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Failed to fetch');
    (caseHistoryService.getCaseHistory as vi.Mock).mockRejectedValue(error);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);

    render(<CaseHistoryTab caseId={123} />);

    await waitFor(
      () => {
        // Component should still render, even if some data fails to load
        expect(screen.getByText('Case Timeline')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
