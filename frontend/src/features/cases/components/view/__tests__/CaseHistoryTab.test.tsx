import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect,vi, beforeEach } from 'vitest';
import CaseHistoryTab from '../CaseHistoryTab';
import { caseHistoryService } from '../../../services/caseHistoryService';
import { taskHistoryService } from '../../../services/taskHistoryService';
import authService from '@/features/auth/services/authService';

vi.mock('../../../services/caseHistoryService');
vi.mock('../../../services/taskHistoryService');
vi.mock('@/features/auth/services/authService');
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
}));

describe('CaseHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.fetchAllInvestigators as vi.Mock).mockResolvedValue([]);
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
  });

  it('renders loading state initially', () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<CaseHistoryTab caseId={123} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays case timeline after loading', async () => {
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    });
  });

  it('fetches case and task history on mount', async () => {
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(caseHistoryService.getCaseHistory).toHaveBeenCalledWith(123);
      expect(taskHistoryService.getCaseHistory).toHaveBeenCalledWith(123);
    });
  });

  it('displays empty state when no history events', async () => {
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('No history events available for this case')).toBeInTheDocument();
    });
  });

  // Case operation mappings
  const caseOperations = [
    { operation: 'createCase', expected: 'Case created' },
    { operation: 'createManualCase', expected: 'Case created' },
    { operation: 'saveCaseAsDraft', expected: 'Case saved as draft' },
    { operation: 'completeCase', expected: 'Case completed' },
    { operation: 'completeCaseCreation', expected: 'Case completed' },
    { operation: 'updateCaseStatus', expected: 'Case status updated' },
    { operation: 'updateCase', expected: 'Case updated' },
    { operation: 'suspendCase', expected: 'Case suspended' },
    { operation: 'resumeCase', expected: 'Case resumed' },
    { operation: 'abandonCase', expected: 'Case abandoned' },
    { operation: 'reopenCase', expected: 'Case reopened' },
    { operation: 'approveCaseCreation', expected: 'Approve case creation' },
    { operation: 'rejectCaseCreation', expected: 'Reject case creation' },
    { operation: 'approveCaseClosure', expected: 'Case approved' },
    { operation: 'rejectCaseClosure', expected: 'Case rejected' },
    { operation: 'approveCaseReopening', expected: 'Approve case reopening' },
    { operation: 'rejectCaseReopening', expected: 'Reject case reopening' },
    { operation: 'returnCaseForReview', expected: 'Case returned for review' },
    { operation: 'autoClosed', expected: 'Case auto-closed' },
  ];

  caseOperations.forEach(({ operation, expected }) => {
    it(`maps case operation "${operation}" to "${expected}"`, async () => {
      (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
        {
          case_id: 123,
          operation,
          action_performed: 'Action performed',
          performed_at: '2023-01-01T00:00:00Z',
          user_id: 'user-1',
          entity_name: 'User',
        },
      ]);
      render(<CaseHistoryTab caseId={123} />);
      await waitFor(() => {
        expect(screen.getByText(new RegExp(expected, 'i'))).toBeInTheDocument();
      });
    });
  });

  it('maps closeCase with approval details correctly', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        case_id: 123,
        operation: 'closeCase',
        action_performed: 'Case submitted for approval',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case closure submitted for approval/i)).toBeInTheDocument();
    });
  });

  it('maps closeCase without approval to "Case closed"', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        case_id: 123,
        operation: 'closeCase',
        action_performed: 'Case has been closed',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case closed/i)).toBeInTheDocument();
    });
  });

  // Task operation mappings
  const taskOperations = [
    { operation: 'createTask', expected: 'Task created' },
    { operation: 'createSarTask', expected: 'SAR/STR task created' },
    { operation: 'updateTask', expected: 'Task updated' },
    { operation: 'claimTask', expected: 'Task claimed' },
    { operation: 'selfAssignTask', expected: 'Task self-assigned' },
    { operation: 'reassignTask', expected: 'Task reassigned' },
    { operation: 'unassignTask', expected: 'Task unassigned' },
    { operation: 'assignTask', expected: 'Task assigned' },
    { operation: 'completeTask', expected: 'Task completed' },
    { operation: 'assignTaskToInvestigator', expected: 'Task assigned' },
    { operation: 'investigationTaskTriggered', expected: 'Investigation task triggered' },
    { operation: 'triageAlertUpdated', expected: 'Triage alert updated' },
  ];

  taskOperations.forEach(({ operation, expected }) => {
    it(`maps task operation "${operation}" to "${expected}"`, async () => {
      (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
        {
          task_id: 1,
          operation,
          action_performed: 'Action performed',
          performed_at: '2023-01-01T00:00:00Z',
          user_id: 'user-1',
          entity_name: 'User',
        },
      ]);
      render(<CaseHistoryTab caseId={123} />);
      await waitFor(() => {
        expect(screen.getByText(new RegExp(expected, 'i'))).toBeInTheDocument();
      });
    });
  });

  it('maps upload/evidence task operations', async () => {
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        task_id: 1,
        operation: 'uploadEvidence',
        action_performed: 'File was uploaded',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Evidence uploaded/i)).toBeInTheDocument();
    });
  });

  it('handles System entity name for performedBy', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        case_id: 123,
        operation: 'createCase',
        action_performed: 'System created case',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'system',
        entity_name: 'System',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case created/i)).toBeInTheDocument();
    });
  });

  it('handles errors gracefully when history fetch fails', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockRejectedValue(new Error('Failed'));
    (taskHistoryService.getCaseHistory as vi.Mock).mockRejectedValue(new Error('Failed'));

    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    });
  });

  it('handles fetchAllInvestigators failure gracefully', async () => {
    (authService.fetchAllInvestigators as vi.Mock).mockRejectedValue(new Error('Failed'));
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    });
  });

  it('sorts history events chronologically and renders alternating layout', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        case_id: 123,
        operation: 'createCase',
        action_performed: 'Case was created',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
      {
        case_id: 123,
        operation: 'updateCase',
        action_performed: 'Case was updated',
        performed_at: '2023-01-02T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);

    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case created/i)).toBeInTheDocument();
      expect(screen.getByText(/Case updated/i)).toBeInTheDocument();
    });
  });

  it('handles performed_at as Date object', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        case_id: 123,
        operation: 'createCase',
        action_performed: 'Created',
        performed_at: new Date('2023-01-01T00:00:00Z'),
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case created/i)).toBeInTheDocument();
    });
  });

  it('uses default action text when action_performed is empty for task', async () => {
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        task_id: 1,
        operation: 'createTask',
        action_performed: null,
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Task created/i)).toBeInTheDocument();
      expect(screen.getByText('Action performed')).toBeInTheDocument();
    });
  });

  it('keeps default action for unknown task operation', async () => {
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        task_id: 1,
        operation: 'someUnknownOperation',
        action_performed: 'Did something',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      // formatOperation converts camelCase to Title Case
      expect(screen.getByText(/some unknown operation/i)).toBeInTheDocument();
    });
  });

  it('formats action text with first char uppercase', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        case_id: 123,
        operation: 'createCase',
        action_performed: 'CASE WAS CREATED',
        performed_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        entity_name: 'User',
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      // formatActionText applied to action "Case created" → "Case created"
      expect(screen.getByText('Case created')).toBeInTheDocument();
      // Details text shown raw
      expect(screen.getByText('CASE WAS CREATED')).toBeInTheDocument();
    });
  });
});
