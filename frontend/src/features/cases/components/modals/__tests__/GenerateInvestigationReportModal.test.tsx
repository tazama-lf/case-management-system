import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateInvestigationReportModal, {
  FINAL_OUTCOMES,
} from '../GenerateInvestigationReportModal';
import { useNotifications } from '@/shared/providers/NotificationProvider';

vi.mock('@/shared/providers/NotificationProvider');
vi.mock('../../../../reports/services/reportsService', () => ({
  default: {
    generateFraudReport: vi.fn(),
  },
}));
vi.mock('../../../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: vi.fn().mockResolvedValue([]),
    updateTaskForSupervisor: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    formatFileSize: vi.fn((size: number) => `${(size / 1024).toFixed(2)} KB`),
    getTaskEvidence: vi.fn().mockResolvedValue({ evidence: [] }),
  },
}));
vi.mock('../../../utils/investigationUtils', () => ({
  loadEvidence: vi.fn().mockResolvedValue([]),
  fetchCasesAndEvidence: vi.fn().mockResolvedValue({
    supervisorComments: [],
    investigatorName: 'John Doe',
    investigationNotes: 'Some investigation notes',
    submittedDate: '2024-01-15',
  }),
}));
vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    vfs: {},
    createPdf: vi.fn(() => ({
      download: vi.fn(),
      open: vi.fn(),
      getBlob: vi.fn((cb: (blob: Blob) => void) => {
        cb(new Blob(['test'], { type: 'application/pdf' }));
      }),
    })),
  },
}));
vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { vfs: {} },
}));
vi.mock('marked', () => ({
  marked: Object.assign((text: string) => `<p>${text}</p>`, {
    setOptions: vi.fn(),
  }),
}));
vi.mock('html-to-pdfmake', () => ({
  default: vi.fn((html: string) => [{ text: html }]),
}));
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: vi.fn((date: string) => date || 'N/A'),
}));

const mockTasks = [
  {
    task_id: 100,
    name: 'Investigate AML',
    status: 'STATUS_30_COMPLETED',
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('GenerateInvestigationReportModal', () => {
  const mockOnClose = vi.fn();
  const mockOnApproved = vi.fn();
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    (useNotifications as vi.Mock).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });
    const taskServiceModule = await import('../../../services/taskService');
    (
      taskServiceModule.taskService.getTasksByCaseId as vi.Mock
    ).mockResolvedValue([
      {
        task_id: 100,
        name: 'Investigate AML',
        status: 'STATUS_30_COMPLETED',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]);
    // Re-set investigationUtils mocks after clearAllMocks
    const investigationUtils =
      await import('../../../utils/investigationUtils');
    (investigationUtils.loadEvidence as vi.Mock).mockResolvedValue([]);
    (investigationUtils.fetchCasesAndEvidence as vi.Mock).mockResolvedValue({
      supervisorComments: [],
      investigatorName: 'John Doe',
      investigationNotes: 'Some investigation notes',
      submittedDate: '2024-01-15',
    });
    // Store auth token for getUserRole
    localStorage.setItem(
      'authToken',
      `header.${btoa(JSON.stringify({ claims: ['CMS_SUPERVISOR'] }))}.signature`,
    );
  });

  it('does not render when open is false', () => {
    render(
      <GenerateInvestigationReportModal
        open={false}
        onClose={mockOnClose}
        caseId={123}
      />,
    );
    expect(
      screen.queryByText(/Generate Case Investigation Report/i),
    ).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: /Generate Case Investigation Report/i,
      }),
    ).toBeInTheDocument();
  });

  it('displays case title', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        caseTitle="Case 123 - Fraud"
        tasks={mockTasks as any}
      />,
    );
    expect(screen.getByText('Case 123 - Fraud')).toBeInTheDocument();
  });

  it('uses default case title when not provided', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );
    expect(screen.getByText('Case CASE-2023-0045 - Fraud')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows initial step with report contents list', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );
    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
    expect(screen.getByText(/Report will include:/i)).toBeInTheDocument();
    expect(screen.getByText(/Executive Summary/)).toBeInTheDocument();
    expect(screen.getByText(/Key Findings/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence Summary/)).toBeInTheDocument();
    expect(screen.getByText(/Final Outcome Decision/)).toBeInTheDocument();
    expect(screen.getByText(/Recommendations/)).toBeInTheDocument();
  });

  it('shows incomplete tasks warning when supervisor has incomplete tasks', async () => {
    const taskServiceModule = await import('../../../services/taskService');
    (
      taskServiceModule.taskService.getTasksByCaseId as vi.Mock
    ).mockResolvedValue([
      {
        task_id: 101,
        name: 'Investigate Fraud',
        status: 'STATUS_20_IN_PROGRESS',
      },
    ]);

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Complete Investigation Tasks First/i),
      ).toBeInTheDocument();
    });
  });

  it('enables Generate Report button when report is ready and tasks are complete', async () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    const btn = screen.getByRole('button', { name: /Generate Report/i });
    expect(btn).not.toBeDisabled();
  });

  it('transitions to generated step when Generate Report is clicked', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        caseData={{
          case_id: 123,
          case_type: 'FRAUD',
          status: 'STATUS_22',
          createdOn: '2024-01-01',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    const btn = screen.getByRole('button', { name: /Generate Report/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);

    await waitFor(() => {
      expect(
        screen.getByText(/Report Generated Successfully/i),
      ).toBeInTheDocument();
    });
  });

  it('shows generated report with case metadata', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        caseData={{
          case_id: 123,
          case_type: 'FRAUD',
          status: 'STATUS_22',
          createdOn: '2024-01-01',
        }}
        selectedOutcome="STATUS_82_CLOSED_CONFIRMED"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Case ID:/i)).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('shows Finalize & Approve Report button for supervisors on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        onApproved={mockOnApproved}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Finalize & Approve Report/i),
      ).toBeInTheDocument();
    });
  });

  it('shows approval confirmation dialog when Finalize is clicked', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        onApproved={mockOnApproved}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Finalize & Approve Report/i),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText(/Finalize & Approve Report/i).closest('button')!,
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirm Approval/i)).toBeInTheDocument();
    });
  });

  it('closes approval dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        onApproved={mockOnApproved}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Finalize & Approve Report/i),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText(/Finalize & Approve Report/i).closest('button')!,
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();
    });

    // Click Cancel in the confirmation dialog
    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() => {
      expect(
        screen.queryByText(/Confirm Report Approval/i),
      ).not.toBeInTheDocument();
    });
  });

  it('exports FINAL_OUTCOMES constant', () => {
    expect(FINAL_OUTCOMES).toHaveLength(3);
    expect(FINAL_OUTCOMES[0].value).toBe('STATUS_83_CLOSED_INCONCLUSIVE');
    expect(FINAL_OUTCOMES[1].value).toBe('STATUS_81_CLOSED_REFUTED');
    expect(FINAL_OUTCOMES[2].value).toBe('STATUS_82_CLOSED_CONFIRMED');
  });

  it('sets selectedOutcome when provided', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        selectedOutcome="STATUS_82_CLOSED_CONFIRMED"
      />,
    );
    // The modal should render without errors and use the outcome
    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
  });

  it('handles task check failure gracefully', async () => {
    const taskServiceModule = await import('../../../services/taskService');
    (
      taskServiceModule.taskService.getTasksByCaseId as vi.Mock
    ).mockRejectedValue(new Error('API Error'));

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Failed to check task status');
    });
  });

  it('handles getUserRole with CMS_INVESTIGATOR', () => {
    localStorage.setItem(
      'authToken',
      `header.${btoa(JSON.stringify({ claims: ['CMS_INVESTIGATOR'] }))}.signature`,
    );

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    // Should render correctly with investigator role
    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
  });

  it('handles getUserRole with invalid token', () => {
    localStorage.setItem('authToken', 'invalid-token');

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    // Should render correctly (falls back to CMS_SUPERVISOR)
    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
  });

  it('handles getUserRole with no token', () => {
    localStorage.removeItem('authToken');

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
  });

  it('renders with selectedFinalNotes', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        selectedFinalNotes="Supervisor final notes"
      />,
    );
    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
  });

  it('finds latest investigate task from tasks list', () => {
    const multipleTasks = [
      {
        task_id: 100,
        name: 'Investigate AML',
        status: 'STATUS_30_COMPLETED',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        task_id: 200,
        name: 'Investigate Fraud',
        status: 'STATUS_30_COMPLETED',
        created_at: '2024-02-01T00:00:00Z',
      },
    ];

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={multipleTasks as any}
      />,
    );

    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
  });

  it('shows evidence categories on generated step', async () => {
    const user = userEvent.setup();
    const investigationUtils =
      await import('../../../utils/investigationUtils');
    (investigationUtils.loadEvidence as vi.Mock).mockResolvedValue([
      {
        type: 'Documents',
        count: 2,
        description: 'files',
        evidence: [
          {
            id: 1,
            fileName: 'report.pdf',
            fileSize: 1024,
            evidenceType: 'DOCUMENT',
            uploadedAt: '2024-01-01T00:00:00Z',
            description: 'Test document',
          },
          {
            id: 2,
            fileName: 'analysis.xlsx',
            fileSize: 2048,
            evidenceType: 'SPREADSHEET',
          },
        ],
      },
    ]);

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
      expect(screen.getByText('analysis.xlsx')).toBeInTheDocument();
    });
  });

  it('shows "No evidence summary" when no evidence loaded', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/No evidence summary attached/i),
      ).toBeInTheDocument();
    });
  });

  it('shows supervisor feedback with selectedFinalNotes on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        selectedFinalNotes="Important supervisor notes"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Important supervisor notes'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Supervisor comments provided in the previous step/i),
      ).toBeInTheDocument();
    });
  });

  it('shows investigation notes on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      // Key Findings section should exist
      expect(screen.getByText('Key Findings')).toBeInTheDocument();
    });
  });

  it('shows "No investigation notes" when notes are empty', async () => {
    const user = userEvent.setup();
    const investigationUtils =
      await import('../../../utils/investigationUtils');
    (investigationUtils.fetchCasesAndEvidence as vi.Mock).mockResolvedValue({
      supervisorComments: [],
      investigatorName: 'John Doe',
      investigationNotes: '',
      submittedDate: '2024-01-15',
    });

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/No investigation notes added/i),
      ).toBeInTheDocument();
    });
  });

  it('shows final outcome on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        selectedOutcome="STATUS_82_CLOSED_CONFIRMED"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Final Outcome Decision')).toBeInTheDocument();
      expect(screen.getByText('82 - Closed Confirmed')).toBeInTheDocument();
    });
  });

  it('shows "Not specified" when no final outcome', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Not specified')).toBeInTheDocument();
    });
  });

  it('shows recommendations section on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Recommendations & Conclusions'),
      ).toBeInTheDocument();
    });
  });

  it('shows executive summary on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        caseData={{
          case_id: 123,
          case_type: 'FRAUD',
          status: 'STATUS_22',
          createdOn: '2024-01-01',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });
  });

  it('shows investigator name and submitted date on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });
  });

  it('calls handleFinalize when Confirm Approval is clicked', async () => {
    const user = userEvent.setup();
    const reportsServiceModule =
      await import('../../../../reports/services/reportsService');
    (
      reportsServiceModule.default.generateFraudReport as vi.Mock
    ).mockResolvedValue({ fileName: 'report-v1.pdf' });

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        onApproved={mockOnApproved}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Finalize & Approve Report/i),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText(/Finalize & Approve Report/i).closest('button')!,
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Confirm Approval/i).closest('button')!);

    await waitFor(() => {
      expect(
        reportsServiceModule.default.generateFraudReport,
      ).toHaveBeenCalled();
    });
  });

  it('handles finalize error gracefully', async () => {
    const user = userEvent.setup();
    const reportsServiceModule =
      await import('../../../../reports/services/reportsService');
    (
      reportsServiceModule.default.generateFraudReport as vi.Mock
    ).mockRejectedValue(new Error('API failure'));

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        onApproved={mockOnApproved}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Finalize & Approve Report/i),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText(/Finalize & Approve Report/i).closest('button')!,
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Confirm Approval/i).closest('button')!);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalled();
    });
  });

  it('shows supervisor review message on generated step', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Review the report content below/i),
      ).toBeInTheDocument();
    });
  });

  it('shows case type on generated step metadata', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        caseData={{
          case_id: 123,
          case_type: 'AML',
          status: 'STATUS_22',
          createdOn: '2024-01-01',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('AML')).toBeInTheDocument();
      expect(screen.getByText('Type:')).toBeInTheDocument();
    });
  });

  it('allows editing executive summary textarea for supervisors', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    // Find executive summary textarea and edit it
    const textareas = screen.getAllByRole('textbox');
    const executiveSummaryTextarea = textareas[0]; // first textarea is executive summary
    await user.clear(executiveSummaryTextarea);
    await user.type(executiveSummaryTextarea, 'Updated executive summary');
    expect(executiveSummaryTextarea).toHaveValue('Updated executive summary');
  });

  it('shows supervisor feedback textarea when supervisorComments exist', async () => {
    const user = userEvent.setup();
    const investigationUtils =
      await import('../../../utils/investigationUtils');
    (investigationUtils.fetchCasesAndEvidence as vi.Mock).mockResolvedValue({
      supervisorComments: [{ comment_id: 1, note: 'Great work' }],
      investigatorName: 'John Doe',
      investigationNotes: 'Some notes',
      submittedDate: '2024-01-15',
    });

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Supervisor Feedback')).toBeInTheDocument();
    });
  });

  it('shows investigator review message (not supervisor)', async () => {
    const user = userEvent.setup();
    // Set role to investigator
    localStorage.setItem(
      'authToken',
      `header.${btoa(JSON.stringify({ claims: ['CMS_INVESTIGATOR'] }))}.signature`,
    );

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    // For investigator, the button should be enabled without task completion check
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Generate Report/i });
      expect(btn).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Review the report content below.'),
      ).toBeInTheDocument();
    });
  });

  it('does not show Finalize button for investigators', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'authToken',
      `header.${btoa(JSON.stringify({ claims: ['CMS_INVESTIGATOR'] }))}.signature`,
    );

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Generate Report/i });
      expect(btn).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Report Generated Successfully/i),
      ).toBeInTheDocument();
    });

    // Investigator should NOT see the Finalize button
    expect(
      screen.queryByText(/Finalize & Approve Report/i),
    ).not.toBeInTheDocument();
  });

  it('allows editing recommendations textarea for supervisors', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Recommendations & Conclusions'),
      ).toBeInTheDocument();
    });

    // Find recommendations textarea (the last textarea in the form)
    const textareas = screen.getAllByRole('textbox');
    const recommendationsTextarea = textareas[textareas.length - 1];
    await user.clear(recommendationsTextarea);
    await user.type(recommendationsTextarea, 'Updated recommendation');
    expect(recommendationsTextarea).toHaveValue('Updated recommendation');
  });

  it('shows approval dialog content with outcome info', async () => {
    const user = userEvent.setup();

    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        tasks={mockTasks as any}
        selectedOutcome="STATUS_82_CLOSED_CONFIRMED"
        onApproved={mockOnApproved}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Checking tasks/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Finalize & Approve Report/i),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText(/Finalize & Approve Report/i).closest('button')!,
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Lock the report for editing/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Archive the report for compliance/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Notify relevant stakeholders/i),
      ).toBeInTheDocument();
    });
  });
});
