import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationSummaryTab from '../InvestigationsSummaryTab';
import { caseService } from '../../../services/caseService';
import { evidenceService } from '../../../services/evidenceService';
import { commentService } from '../../../services/commentService';
import { taskService } from '../../../services/taskService';
import authService from '@/features/auth/services/authService';

vi.mock('../../../services/caseService');
vi.mock('../../../services/evidenceService');
vi.mock('../../../services/commentService');
vi.mock('../../../services/taskService');
vi.mock('@/features/auth/services/authService');
vi.mock('../../../hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    getAssigneeFullName: (assignee?: string) => {
      if (assignee === 'user-1') return 'John Doe';
      if (assignee === 'supervisor-1') return 'Jane Supervisor';
      return '';
    },
    fetchInvestigatorsList: vi.fn(),
    fetchSupervisorsList: vi.fn(),
  }),
}));
const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));
vi.mock('../../modals/CompleteTaskModal', () => ({
  default: ({ open, onCompleteTask, task, onClose }: any) =>
    open ? (
      <div data-testid="complete-modal">
        <button onClick={() => onCompleteTask(task)}>Confirm Complete</button>
        <button onClick={onClose}>Close Complete</button>
      </div>
    ) : null,
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
    global.alert = vi.fn();
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
      expect(screen.getByText(/Investigation notes here/i)).toBeInTheDocument();
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
      expect(screen.getByText(/No evidence uploaded yet/i)).toBeInTheDocument();
    });
  });

  it('shows Refuted outcome for REFUTED status', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_81_CLOSED_REFUTED',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Refuted/i)).toBeInTheDocument();
    });
  });

  it('shows Inconclusive outcome for INCONCLUSIVE status', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_83_CLOSED_INCONCLUSIVE',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Inconclusive/i)).toBeInTheDocument();
    });
  });

  it('does not show outcome section for in-progress status', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      status: 'STATUS_20_IN_PROGRESS',
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      const caseIds = screen.getAllByText('CASE-123');
      expect(caseIds.length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Recommended Outcome')).not.toBeInTheDocument();
  });

  it('does not show complete button when user is not assigned', async () => {
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'other-user',
      validatedClaims: {},
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      const caseIds = screen.getAllByText('CASE-123');
      expect(caseIds.length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByText('Complete Investigation'),
    ).not.toBeInTheDocument();
  });

  it('does not show complete button when task is completed', async () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0] },
      { ...mockTasks[1], status: 'STATUS_30_COMPLETED' },
    ]);
    render(<InvestigationSummaryTab caseId={123} task={completedTask} />);
    await waitFor(() => {
      const caseIds = screen.getAllByText('CASE-123');
      expect(caseIds.length).toBeGreaterThan(0);
    });
    expect(
      screen.queryByText('Complete Investigation'),
    ).not.toBeInTheDocument();
  });

  it('handles download evidence click', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.downloadEvidence as vi.Mock).mockResolvedValue(mockBlob);
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
        const downloadBtns = screen.queryAllByText('Download');
        expect(downloadBtns.length).toBeGreaterThan(0);
      });
      const downloadBtn = screen.getAllByText('Download')[0];
      fireEvent.click(downloadBtn);
      await waitFor(() => {
        expect(evidenceService.downloadEvidence).toHaveBeenCalledWith(
          'EVIDENCE-1',
        );
      });
    }
  });

  it('handles case details fetch error', async () => {
    (caseService.getCaseDetails as vi.Mock).mockRejectedValue(
      new Error('Failed'),
    );
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    // Should stop loading even on error
    await waitFor(
      () => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('displays multiple evidence categories', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'E1',
          fileName: 'kyc.pdf',
          evidenceType: 'KYC',
          fileSize: 1024,
          uploadedAt: '2023-01-01',
        },
        {
          id: 'E2',
          fileName: 'sanctions.pdf',
          evidenceType: 'SANCTIONS',
          fileSize: 2048,
          uploadedAt: '2023-01-02',
        },
        {
          id: 'E3',
          fileName: 'media.pdf',
          evidenceType: 'ADVERSE_MEDIA',
          fileSize: 512,
          uploadedAt: '2023-01-03',
        },
      ],
      total: 3,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/KYC\/EDD Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
      expect(screen.getByText(/Adverse Media Screening/i)).toBeInTheDocument();
    });
  });

  it('shows submitted date label', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });
  });

  it('toggles evidence category open and closed', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
    const btn = screen.getByText(/Sanctions Screening/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    });
  });

  it('displays investigator name', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('shows case priority', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });
  });

  it('shows case type', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      const fraudTexts = screen.getAllByText('FRAUD');
      expect(fraudTexts.length).toBeGreaterThan(0);
    });
  });

  it('renders OTHER evidence type', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'E-OTHER',
          fileName: 'doc.txt',
          evidenceType: 'OTHER',
          fileSize: 100,
          uploadedAt: '2023-01-01',
        },
      ],
      total: 1,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Other supporting Documentation/i),
      ).toBeInTheDocument();
    });
  });

  it('renders SAR_STR_FILING evidence type', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'E-SAR',
          fileName: 'sar.pdf',
          evidenceType: 'SAR_STR_FILING',
          fileSize: 100,
          uploadedAt: '2023-01-01',
        },
      ],
      total: 1,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/SAR\/STR Filing/i)).toBeInTheDocument();
    });
  });

  it('shows document count in evidence category', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'E1',
          fileName: 'a.pdf',
          evidenceType: 'SANCTIONS',
          fileSize: 100,
          uploadedAt: '2023-01-01',
        },
        {
          id: 'E2',
          fileName: 'b.pdf',
          evidenceType: 'SANCTIONS',
          fileSize: 200,
          uploadedAt: '2023-01-02',
        },
      ],
      total: 2,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/2 documents/i)).toBeInTheDocument();
    });
  });

  it('shows singular document text for 1 file', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/\(1 document\)/i)).toBeInTheDocument();
    });
  });

  it('handles download error gracefully', async () => {
    (evidenceService.downloadEvidence as vi.Mock).mockRejectedValue(
      new Error('Download failed'),
    );
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
    const btn = screen.getByText(/Sanctions Screening/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      const downloadBtns = screen.queryAllByText('Download');
      expect(downloadBtns.length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Download')[0]);
    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalled();
    });
  });

  it('does not render complete button when task is blocked', async () => {
    const blockedTask = { ...mockTask, status: 'STATUS_21_BLOCKED' };
    render(<InvestigationSummaryTab caseId={123} task={blockedTask} />);
    await waitFor(() => {
      const caseIds = screen.getAllByText('CASE-123');
      expect(caseIds.length).toBeGreaterThan(0);
    });
    const completeBtn = screen.queryByText('Complete Investigation');
    if (completeBtn) {
      expect(completeBtn).not.toBeVisible();
    }
  });

  it('shows evidence file names in expanded category', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
    const btn = screen.getByText(/Sanctions Screening/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('1 KB')).toBeInTheDocument();
    });
  });

  it('shows supervisor comment when present', async () => {
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([
      {
        comment_id: '1',
        note: 'supervisor approval: Case looks good for closure',
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

  it('opens complete modal and confirms task completion', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Complete Investigation'));
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
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Complete Investigation'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Complete'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });

  it('closes complete modal without completing', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Complete Investigation'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Complete'));
    await waitFor(() => {
      expect(screen.queryByTestId('complete-modal')).not.toBeInTheDocument();
    });
  });

  it('shows supervisor final outcome for closed case with comments', async () => {
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([
      {
        comment_id: '1',
        note: 'Supervisor Approval: Case confirmed as fraud',
        created_at: '2023-01-03T00:00:00Z',
        user_id: 'supervisor-1',
        case_id: 123,
        task_id: 1,
      },
    ]);
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Supervisor Final Outcome')).toBeInTheDocument();
    });
  });

  it('shows no investigation notes message when notes are empty', async () => {
    (taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([
      { ...mockTasks[0] },
      { ...mockTasks[1], investigationNotes: null },
    ]);
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(
        screen.getByText(/No investigation notes available/i),
      ).toBeInTheDocument();
    });
  });

  it('shows case creation date in metadata', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      const createdLabels = screen.getAllByText('Created:');
      expect(createdLabels.length).toBeGreaterThan(0);
    });
  });

  it('calls onTaskUpdate after successful completion', async () => {
    const onTaskUpdate = vi.fn();
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    render(
      <InvestigationSummaryTab
        caseId={123}
        task={mockTask}
        onTaskUpdate={onTaskUpdate}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Complete Investigation')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Complete Investigation'));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Complete'));
    await waitFor(() => {
      expect(onTaskUpdate).toHaveBeenCalled();
    });
  });

  it('shows evidence file type badge in expanded category', async () => {
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
    const btn = screen.getByText(/Sanctions Screening/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('SANCTIONS')).toBeInTheDocument();
    });
  });

  it('shows N/A for case ID when case details missing', async () => {
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue({
      ...mockCase,
      case_id: undefined,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      const naTexts = screen.getAllByText('N/A');
      expect(naTexts.length).toBeGreaterThan(0);
    });
  });

  it('displays evidence description when available', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'E1',
          fileName: 'desc.pdf',
          evidenceType: 'SANCTIONS',
          fileSize: 1024,
          uploadedAt: '2023-01-01',
          description: 'Important document about case',
        },
      ],
      total: 1,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText(/Sanctions Screening/i)).toBeInTheDocument();
    });
    const btn = screen.getByText(/Sanctions Screening/i).closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(
        screen.getByText('Important document about case'),
      ).toBeInTheDocument();
    });
  });

  it('handles unknown evidence types in categories', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'E-UNK',
          fileName: 'mystery.pdf',
          evidenceType: 'CUSTOM_TYPE',
          fileSize: 100,
          uploadedAt: '2023-01-01',
        },
      ],
      total: 1,
    });
    render(<InvestigationSummaryTab caseId={123} task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('CUSTOM_TYPE')).toBeInTheDocument();
    });
  });
});
