import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationSummaryTab from '../InvestigationsSummaryTab';
import { caseService } from '../../../services/caseService';
import { evidenceService } from '../../../services/evidenceService';
import { commentService } from '../../../services/commentService';
import { taskService } from '../../../services/taskService';
import userService from '../../../services/userService';
import authService from '@/features/auth/services/authService';

vi.mock('../../../services/caseService');
vi.mock('../../../services/evidenceService');
vi.mock('../../../services/commentService');
vi.mock('../../../services/taskService');
vi.mock('../../../services/userService');
vi.mock('@/features/auth/services/authService');
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../modals/CompleteTaskModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="complete-modal">Complete Modal</div> : null,
}));

describe('InvestigationSummaryTab', () => {
  const mockTask = {
    task_id: 2,
    name: 'Investigate Case',
    status: 'STATUS_20_IN_PROGRESS',
    assigned_user_id: 'user-1',
    case_id: 123,
  };

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
      },
    ],
    total: 1,
  };

  const mockTasks = [
    {
      task_id: 1,
      name: 'Approve Case Closure',
      created_at: '2023-01-03T00:00:00Z',
      assigned_user_id: 'supervisor-1',
    },
    {
      task_id: 2,
      name: 'Investigate Case',
      investigationNotes: 'Investigation notes here',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      assigned_user_id: 'user-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'user-1',
      validatedClaims: {},
    });
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue(
      mockEvidence,
    );
    (evidenceService.formatFileSize as vi.Mock).mockReturnValue('1 KB');
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue(mockTasks);
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([]);
    (userService.getUserDetailsById as vi.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
    });
    (userService.formatUserName as vi.Mock).mockReturnValue('John Doe');
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays case details after loading', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      const caseIds = screen.getAllByText('CASE-123');
      expect(caseIds.length).toBeGreaterThan(0);
      const fraudTexts = screen.getAllByText('FRAUD');
      expect(fraudTexts.length).toBeGreaterThan(0);
    });
  });

  it('fetches case details and evidence on mount', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith(123);
      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith(123);
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(2);
    });
  });

  it('displays recommended outcome', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Recommended Outcome')).toBeInTheDocument();
      expect(screen.getByText(/Confirmed Fraud/i)).toBeInTheDocument();
    });
  });

  it('displays investigation notes when available', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Investigation notes here/i),
      ).toBeInTheDocument();
    });
  });

  it('displays supervisor approval when comments exist', async () => {
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([
      {
        comment_id: '1',
        note: 'Supervisor Approval: Approved',
        created_at: '2023-01-03T00:00:00Z',
        user_id: 'supervisor-1',
        case_id: 123,
        task_id: 1,
      },
    ]);

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Supervisor Approval')).toBeInTheDocument();
    });
  });

  it('displays evidence summary with categories', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
  });

  it('shows complete investigation button when task is assigned to current user', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });
  });

  it('allows expanding evidence categories', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });

    const categoryButton = screen
      .getByText(/Sanctions Screening/i)
      .closest('button');
    if (categoryButton) {
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    }
  });

  it('allows expanding evidence categories to see download button', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.downloadEvidence as vi.Mock).mockResolvedValue(mockBlob);

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });

    const categoryButton = screen
      .getByText(/Sanctions Screening/i)
      .closest('button');
    if (categoryButton) {
      fireEvent.click(categoryButton);

      await waitFor(() => {
        // After expanding, download button should be available
        const downloadButtons = screen.queryAllByText('Download');
        expect(downloadButtons.length).toBeGreaterThan(0);
      });
    }
  });

  it('displays empty state when no evidence', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
      total: 0,
    });
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      {
        task_id: 2,
        name: 'Investigate Case',
        created_at: '2023-01-01T00:00:00Z',
        assigned_user_id: 'user-1',
      },
    ]);

    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No evidence uploaded yet/i),
      ).toBeInTheDocument();
    });
  });
});
