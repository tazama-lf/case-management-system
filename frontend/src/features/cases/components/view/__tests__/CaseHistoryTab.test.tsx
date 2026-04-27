import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseHistoryTab from '../CaseHistoryTab';
import { caseHistoryService } from '../../../services/caseHistoryService';
import { taskHistoryService } from '../../../services/taskHistoryService';
import authService from '@/features/auth/services/authService';

vi.mock('../../../services/caseHistoryService');
vi.mock('../../../services/taskHistoryService');
vi.mock('@/features/auth/services/authService');
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d || 'N/A',
}));

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
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'createCase',
        entity_name: 'User',
        action_performed: 'Case submitted for approval',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Case submitted for approval/i),
      ).toBeInTheDocument();
    });
  });

  it('displays task events', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
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
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Investigation completed/i)).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockRejectedValue(
      new Error('Failed'),
    );
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(
      () => {
        expect(screen.getByText('Case Timeline')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('maps saveCaseAsDraft operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'saveCaseAsDraft',
        entity_name: 'User',
        action_performed: 'Draft saved',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Draft saved/i)).toBeInTheDocument();
    });
  });

  it('maps completeCase operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'completeCase',
        entity_name: 'User',
        action_performed: 'Case done',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case done/i)).toBeInTheDocument();
    });
  });

  it('maps suspendCase operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'suspendCase',
        entity_name: 'User',
        action_performed: 'Pending further review',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case suspended')).toBeInTheDocument();
    });
  });

  it('maps resumeCase operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'resumeCase',
        entity_name: 'User',
        action_performed: 'Review complete, continuing',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case resumed')).toBeInTheDocument();
    });
  });

  it('maps closeCase with approval operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'closeCase',
        entity_name: 'User',
        action_performed: 'Closure pending approval from supervisor',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByText('Case closure submitted for approval'),
      ).toBeInTheDocument();
    });
  });

  it('maps abandonCase operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'abandonCase',
        entity_name: 'User',
        action_performed: 'No longer relevant',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case abandoned')).toBeInTheDocument();
    });
  });

  it('maps reopenCase operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'reopenCase',
        entity_name: 'User',
        action_performed: 'New evidence found',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case reopened')).toBeInTheDocument();
    });
  });

  it('maps approveCaseCreation operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'approveCaseCreation',
        entity_name: 'User',
        action_performed: 'Approved',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Approved/i)).toBeInTheDocument();
    });
  });

  it('maps rejectCaseCreation operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'rejectCaseCreation',
        entity_name: 'User',
        action_performed: 'Rejected',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Rejected/i)).toBeInTheDocument();
    });
  });

  it('maps approveCaseClosure operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'approveCaseClosure',
        entity_name: 'User',
        action_performed: 'Closure approved',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Closure approved/i)).toBeInTheDocument();
    });
  });

  it('maps rejectCaseClosure operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'rejectCaseClosure',
        entity_name: 'User',
        action_performed: 'Closure rejected',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Closure rejected/i)).toBeInTheDocument();
    });
  });

  it('maps approveCaseReopening operation', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'approveCaseReopening',
        entity_name: 'User',
        action_performed: 'Reopening approved',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Reopening approved/i)).toBeInTheDocument();
    });
  });

  it('maps rejectCaseReopening and returnCaseForReview and autoClosed', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'rejectCaseReopening',
        entity_name: 'User',
        action_performed: 'Reopening denied by supervisor',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
      {
        event_log_id: '2',
        user_id: 'user-1',
        operation: 'returnCaseForReview',
        entity_name: 'User',
        action_performed: 'Needs additional info',
        case_id: 123,
        performed_at: '2023-01-02T00:00:00Z',
      },
      {
        event_log_id: '3',
        user_id: 'user-1',
        operation: 'autoClosed',
        entity_name: 'System',
        action_performed: 'Timed out after 30 days',
        case_id: 123,
        performed_at: '2023-01-03T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Reject case reopening')).toBeInTheDocument();
      expect(screen.getByText('Case returned for review')).toBeInTheDocument();
      expect(screen.getByText('Case auto-closed')).toBeInTheDocument();
    });
  });

  it('maps task operations: create, assign, reassign, unassign, claim, selfAssign', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'createTask',
        entity_name: 'User',
        action_performed: 'New investigation task added',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
        task_id: 1,
      },
      {
        event_log_id: '2',
        user_id: 'user-1',
        operation: 'assignTask',
        entity_name: 'User',
        action_performed: 'Given to John Doe',
        case_id: 123,
        performed_at: '2023-01-02T00:00:00Z',
        task_id: 2,
      },
      {
        event_log_id: '3',
        user_id: 'user-1',
        operation: 'reassignTask',
        entity_name: 'User',
        action_performed: 'Transferred to Jane Smith',
        case_id: 123,
        performed_at: '2023-01-03T00:00:00Z',
        task_id: 3,
      },
      {
        event_log_id: '4',
        user_id: 'user-1',
        operation: 'unassignTask',
        entity_name: 'User',
        action_performed: 'Removed from assignee',
        case_id: 123,
        performed_at: '2023-01-04T00:00:00Z',
        task_id: 4,
      },
      {
        event_log_id: '5',
        user_id: 'user-1',
        operation: 'claimTask',
        entity_name: 'User',
        action_performed: 'Picked up by user',
        case_id: 123,
        performed_at: '2023-01-05T00:00:00Z',
        task_id: 5,
      },
      {
        event_log_id: '6',
        user_id: 'user-1',
        operation: 'selfAssignTask',
        entity_name: 'User',
        action_performed: 'User took ownership',
        case_id: 123,
        performed_at: '2023-01-06T00:00:00Z',
        task_id: 6,
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Task created')).toBeInTheDocument();
      expect(screen.getByText('Task assigned')).toBeInTheDocument();
      expect(screen.getByText('Task reassigned')).toBeInTheDocument();
      expect(screen.getByText('Task unassigned')).toBeInTheDocument();
      expect(screen.getByText('Task claimed')).toBeInTheDocument();
      expect(screen.getByText('Task self-assigned')).toBeInTheDocument();
    });
  });

  it('maps createSarTask, updateTask, uploadEvidence task operations', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'createSarTask',
        entity_name: 'User',
        action_performed: 'SAR task created',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
        task_id: 1,
      },
      {
        event_log_id: '2',
        user_id: 'user-1',
        operation: 'updateTask',
        entity_name: 'User',
        action_performed: 'Updated',
        case_id: 123,
        performed_at: '2023-01-02T00:00:00Z',
        task_id: 2,
      },
      {
        event_log_id: '3',
        user_id: 'user-1',
        operation: 'uploadEvidence',
        entity_name: 'User',
        action_performed: 'Evidence uploaded',
        case_id: 123,
        performed_at: '2023-01-03T00:00:00Z',
        task_id: 3,
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/SAR task created/i)).toBeInTheDocument();
    });
  });

  it('maps completeCaseCreation and updateCaseStatus and updateCase', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'completeCaseCreation',
        entity_name: 'User',
        action_performed: 'Creation completed',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
      {
        event_log_id: '2',
        user_id: 'user-1',
        operation: 'updateCaseStatus',
        entity_name: 'User',
        action_performed: 'Status updated',
        case_id: 123,
        performed_at: '2023-01-02T00:00:00Z',
      },
      {
        event_log_id: '3',
        user_id: 'user-1',
        operation: 'updateCase',
        entity_name: 'User',
        action_performed: 'Updated',
        case_id: 123,
        performed_at: '2023-01-03T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Creation completed/i)).toBeInTheDocument();
    });
  });

  it('maps assignTaskToInvestigator and investigationTaskTriggered and triageAlertUpdated', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'assignTaskToInvestigator',
        entity_name: 'User',
        action_performed: 'Task assigned to investigator',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
        task_id: 1,
      },
      {
        event_log_id: '2',
        user_id: 'user-1',
        operation: 'investigationTaskTriggered',
        entity_name: 'User',
        action_performed: 'Investigation triggered',
        case_id: 123,
        performed_at: '2023-01-02T00:00:00Z',
        task_id: 2,
      },
      {
        event_log_id: '3',
        user_id: 'user-1',
        operation: 'triageAlertUpdated',
        entity_name: 'User',
        action_performed: 'Triage updated',
        case_id: 123,
        performed_at: '2023-01-03T00:00:00Z',
        task_id: 3,
      },
    ]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Task assigned to investigator/i),
      ).toBeInTheDocument();
    });
  });

  it('shows System auto-closed event', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'system',
        operation: 'autoClosed',
        entity_name: 'System',
        action_performed: 'Timed out after 30 days',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case auto-closed')).toBeInTheDocument();
      expect(screen.getByText('Timed out after 30 days')).toBeInTheDocument();
    });
  });

  it('handles investigator fetch failure gracefully', async () => {
    (authService.fetchAllInvestigators as vi.Mock).mockRejectedValue(
      new Error('Failed'),
    );
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText('Case Timeline')).toBeInTheDocument();
    });
  });

  it('closeCase without approval text', async () => {
    (caseHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([
      {
        event_log_id: '1',
        user_id: 'user-1',
        operation: 'closeCase',
        entity_name: 'User',
        action_performed: 'Case closed permanently',
        case_id: 123,
        performed_at: '2023-01-01T00:00:00Z',
      },
    ]);
    (taskHistoryService.getCaseHistory as vi.Mock).mockResolvedValue([]);
    render(<CaseHistoryTab caseId={123} />);
    await waitFor(() => {
      expect(screen.getByText(/Case closed permanently/i)).toBeInTheDocument();
    });
  });
});
