import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationSummaryTab from '../InvestigationsSummaryTab';
import { caseService } from '../../../services/caseService';
import { evidenceService } from '../../../services/evidenceService';
import { commentService } from '../../../services/commentService';
import { taskService } from '../../../services/taskService';
import userService from '../../../services/userService';
import type { TaskForSupervisor } from '../../../services/taskService';

vi.mock('../../../services/caseService');
vi.mock('../../../services/evidenceService');
vi.mock('../../../services/commentService');
vi.mock('../../../services/taskService');
vi.mock('../../../services/userService', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    default: {
      getUserDetailsById: vi.fn(),
    },
    UserService: {
      ...original.UserService,
      formatUserName: (user: any) =>
        user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
    },
  };
});

const mockSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockToastError,
  }),
}));
vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'user-1' }),
  },
}));
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
}));
vi.mock('marked', () => ({
  marked: Object.assign((text: string) => `<p>${text}</p>`, {
    setOptions: vi.fn(),
  }),
}));
vi.mock('../../modals/CompleteTaskModal', () => ({
  default: ({ open, onClose, onCompleteTask, task }: any) =>
    open ? (
      <div data-testid="complete-modal">
        <button data-testid="complete-btn" onClick={() => onCompleteTask(task, 'notes')}>Complete</button>
        <button data-testid="close-modal-btn" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const mockTask: TaskForSupervisor = {
  task_id: 1,
  name: 'Investigate Case',
  description: 'Investigate the case thoroughly',
  status: 'STATUS_20_IN_PROGRESS',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-02T00:00:00Z',
  case_id: 123,
  assigned_user_id: 'user-1',
  candidateGroup: 'investigations',
  investigationNotes: 'Investigation notes here',
};

describe('InvestigationSummaryTab', () => {
  const mockCase = {
    case_id: 123,
    case_type: 'FRAUD',
    status: 'STATUS_82_CLOSED_CONFIRMED',
    priority: 'HIGH',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
  };

  const mockEvidence = {
    evidence: [
      {
        id: 'EVIDENCE-1',
        fileName: 'test.pdf',
        evidenceType: 'SANCTIONS',
        fileSize: 1024,
        uploadedAt: '2023-01-01T00:00:00Z',
        description: 'Sanctions doc',
      },
    ],
  };

  const mockTasks = [
    {
      task_id: 2,
      name: 'Approve Case Closure',
      status: 'STATUS_20_IN_PROGRESS',
      case_id: 123,
    },
    {
      task_id: 1,
      name: 'Investigate Case',
      status: 'STATUS_20_IN_PROGRESS',
      case_id: 123,
      assigned_user_id: 'user-1',
      investigationNotes: 'Investigation notes here',
      updated_at: '2023-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue(mockEvidence);
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([]);
    (userService.getUserDetailsById as vi.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays case details after loading', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      const caseIds = screen.getAllByText(/CASE-123/);
      expect(caseIds.length).toBeGreaterThan(0);
      const fraudTexts = screen.getAllByText('FRAUD');
      expect(fraudTexts.length).toBeGreaterThan(0);
    });
  });

  it('displays recommended outcome for closed CONFIRMED case', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Recommended Outcome')).toBeInTheDocument();
      expect(screen.getByText(/Confirmed Fraud/i)).toBeInTheDocument();
    });
  });

  it('displays recommended outcome for closed REFUTED case', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_81_CLOSED_REFUTED',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Refuted')).toBeInTheDocument();
    });
  });

  it('displays recommended outcome for closed INCONCLUSIVE case', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_83_CLOSED_INCONCLUSIVE',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Inconclusive')).toBeInTheDocument();
    });
  });

  it('does not show recommended outcome for non-closed case', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_20_IN_PROGRESS',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    });
    expect(screen.queryByText('Recommended Outcome')).not.toBeInTheDocument();
  });

  it('displays investigation notes when available', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    });
  });

  it('displays no investigation notes message when empty', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[1], investigationNotes: null },
    ]);
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('No investigation notes available.')).toBeInTheDocument();
    });
  });

  it('displays evidence summary with categories', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
  });

  it('expands evidence category to show documents', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });

    const categoryButton = screen.getByText(/Sanctions Screening/i).closest('button');
    if (categoryButton) {
      fireEvent.click(categoryButton);
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(screen.getByText('Sanctions doc')).toBeInTheDocument();
      });
    }
  });

  it('collapses expanded evidence category', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });

    const categoryButton = screen.getByText(/Sanctions Screening/i).closest('button');
    if (categoryButton) {
      fireEvent.click(categoryButton);
      await waitFor(() => expect(screen.getByText('test.pdf')).toBeInTheDocument());
      fireEvent.click(categoryButton);
      await waitFor(() => expect(screen.queryByText('test.pdf')).not.toBeInTheDocument());
    }
  });

  it('displays empty evidence state', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({ evidence: [] });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/No evidence uploaded yet/i)).toBeInTheDocument();
    });
  });

  it('displays case metadata', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Priority:')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });
  });

  it('shows Complete Investigation button when user is assigned and task not completed', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_20_IN_PROGRESS',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });
  });

  it('hides Complete Investigation button when task is completed', async () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[1], status: 'STATUS_30_COMPLETED' },
    ]);
    render(<InvestigationSummaryTab caseId={123} task={completedTask} />);
    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    });
    expect(screen.queryByText('Complete Investigation')).not.toBeInTheDocument();
  });

  it('opens complete task modal and completes task', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_20_IN_PROGRESS',
    });
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Complete Investigation'));

    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('complete-btn'));

    await waitFor(() => {
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it('handles complete task error', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_20_IN_PROGRESS',
    });
    (taskService.updateTaskForSupervisor as vi.Mock).mockRejectedValue(new Error('Failed'));

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Complete Investigation'));
    await waitFor(() => expect(screen.getByTestId('complete-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('complete-btn'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('handles download evidence', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.downloadEvidence as vi.Mock).mockResolvedValue(mockBlob);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument());

    const categoryButton = screen.getByText(/Sanctions Screening/i).closest('button');
    fireEvent.click(categoryButton!);
    await waitFor(() => expect(screen.getByText('test.pdf')).toBeInTheDocument());

    const downloadBtn = screen.getByText('Download');
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalledWith('EVIDENCE-1');
    });
  });

  it('handles download evidence error', async () => {
    (evidenceService.downloadEvidence as vi.Mock).mockRejectedValue(new Error('Download failed'));

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument());

    const categoryButton = screen.getByText(/Sanctions Screening/i).closest('button');
    fireEvent.click(categoryButton!);
    await waitFor(() => expect(screen.getByText('test.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Download'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Failed to download'));
    });
  });

  it('displays supervisor comments when available', async () => {
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([
      {
        comment_id: 'c-1',
        note: 'Supervisor notes content',
        created_at: '2023-01-03T00:00:00Z',
      },
    ]);

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Supervisor Approval')).toBeInTheDocument();
    });
  });

  it('displays investigator name', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('handles case details fetch error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (caseService.getCaseDetails as vi.Mock).mockRejectedValue(new Error('fail'));
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it('calls onTaskUpdate after completing task', async () => {
    const onTaskUpdate = vi.fn();
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_20_IN_PROGRESS',
    });
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});

    render(<InvestigationSummaryTab caseId={123} task={mockTask} onTaskUpdate={onTaskUpdate} />);
    await waitFor(() => expect(screen.getByText('Complete Investigation')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Complete Investigation'));
    await waitFor(() => expect(screen.getByTestId('complete-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('complete-btn'));

    await waitFor(() => {
      expect(onTaskUpdate).toHaveBeenCalled();
    });
  });
});
