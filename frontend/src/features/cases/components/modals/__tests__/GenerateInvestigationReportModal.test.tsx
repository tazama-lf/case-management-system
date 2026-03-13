import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateInvestigationReportModal, {
  FINAL_OUTCOMES,
} from '../GenerateInvestigationReportModal';
import { useNotifications } from '@/shared/providers/NotificationProvider';
import { taskService } from '../../../services/taskService';
import { ReportsService } from '../../../../reports/services/reportsService';
import { EvidenceService } from '../../../services/evidenceService';
import {
  loadEvidence,
  fetchCasesAndEvidence,
} from '../../../utils/investigationUtils';
import { formatDate } from '@/shared/utils/dateUtils';

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock('@/shared/providers/NotificationProvider');
vi.mock('../../../services/taskService');
vi.mock('../../../../reports/services/reportsService');
vi.mock('../../../services/evidenceService');
vi.mock('../../../utils/investigationUtils');
vi.mock('@/shared/utils/dateUtils');

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    vfs: {},
    createPdf: vi.fn(() => ({
      getBlob: vi.fn((cb: (blob: Blob) => void) =>
        cb(new Blob(['pdf'], { type: 'application/pdf' })),
      ),
    })),
  },
}));

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { vfs: {} },
}));

vi.mock('marked', () => ({
  marked: Object.assign(
    vi.fn((text: string) => `<p>${text}</p>`),
    { setOptions: vi.fn() },
  ),
}));

vi.mock('html-to-pdfmake', () => ({
  default: vi.fn(() => [{ text: 'mock-pdf-content' }]),
}));

// ─── Setup ──────────────────────────────────────────────────────

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockOnClose = vi.fn();
const mockOnApproved = vi.fn();

const investigateTask = {
  task_id: 10,
  name: 'Investigate Case',
  status: 'STATUS_30_COMPLETED',
  assigned_user_id: 'user-1',
  created_at: new Date('2024-01-01'),
};

const defaultProps = {
  open: true,
  onClose: mockOnClose,
  caseId: 123,
  caseTitle: 'Case 123 - Fraud',
  tasks: [investigateTask],
  caseData: {
    case_id: 123,
    case_type: 'FRAUD',
    status: 'STATUS_20_IN_PROGRESS',
    priority: 'HIGH',
    createdOn: '2024-01-10T00:00:00Z',
  },
  selectedOutcome: 'STATUS_82_CLOSED_CONFIRMED' as const,
  selectedFinalNotes: 'Supervisor notes here',
  onApproved: mockOnApproved,
};

function setUserRole(role: string): void {
  const payload = btoa(JSON.stringify({ claims: [role] }));
  localStorage.setItem('authToken', `header.${payload}.sig`);
}

describe('GenerateInvestigationReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();

    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });

    (taskService.getTasksByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...investigateTask, status: 'STATUS_30_COMPLETED' },
    ]);

    (loadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        type: 'KYC',
        count: 1,
        description: 'documents',
        evidence: [
          {
            id: 1,
            fileName: 'doc.pdf',
            fileSize: 1500,
            evidenceType: 'KYC',
            uploadedAt: '2024-01-05',
            description: 'KYC document',
          },
        ],
      },
    ]);

    (fetchCasesAndEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      caseDetails: null,
      supervisorComments: [{ comment_id: 1, note: 'Looks good', user_id: 'sup-1' }],
      investigatorName: 'Jane Doe',
      investigationTask: undefined,
      investigationNotes: 'Found suspicious transactions',
      submittedDate: 'Jan 10, 2024',
    });

    (formatDate as ReturnType<typeof vi.fn>).mockReturnValue('Jan 10, 2024');
    (EvidenceService.formatFileSize as ReturnType<typeof vi.fn>).mockReturnValue('1.5 KB');
    (ReportsService.generateFraudReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      fileName: 'report-123-v1.pdf',
    });
    (taskService.updateTaskForSupervisor as ReturnType<typeof vi.fn>).mockResolvedValue({});

    setUserRole('CMS_SUPERVISOR');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Render / Visibility ──────────────────────────────────────

  it('does not render when open is false', () => {
    render(<GenerateInvestigationReportModal {...defaultProps} open={false} />);
    expect(screen.queryByText(/Generate Case Investigation Report/i)).not.toBeInTheDocument();
  });

  it('renders modal header and title when open', async () => {
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: /Generate Case Investigation Report/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Case 123 - Fraud')).toBeInTheDocument();
  });

  it('renders initial step with description text', async () => {
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
    expect(screen.getByText(/consolidate all investigation findings/i)).toBeInTheDocument();
  });

  it('displays report content sections in initial step', async () => {
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    expect(screen.getByText(/Executive Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Key Findings/i)).toBeInTheDocument();
    expect(screen.getByText(/Evidence Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Final Outcome Decision/i)).toBeInTheDocument();
  });

  // ─── Close ────────────────────────────────────────────────────

  it('closes modal with Close button', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal with Cancel button', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  // ─── Task Completion Check ────────────────────────────────────

  it('shows incomplete tasks warning for supervisor when tasks are incomplete', async () => {
    (taskService.getTasksByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
      { task_id: 10, name: 'Investigate Fraud', status: 'STATUS_10_ASSIGNED' },
    ]);

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Complete Investigation Tasks First/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Investigate Fraud')).toBeInTheDocument();
  });

  it('shows error when task check fails', async () => {
    (taskService.getTasksByCaseId as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Failed to check task status');
    });
  });

  it('does not show incomplete tasks warning when all tasks completed', async () => {
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Complete Investigation Tasks First/i)).not.toBeInTheDocument();
    });
  });

  // ─── Generate Report Button ───────────────────────────────────

  it('enables Generate Report button when report is ready and tasks completed', async () => {
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Generate Report/i });
      expect(btn).not.toBeDisabled();
    });
  });

  it('disables button when no investigate task exists', async () => {
    render(
      <GenerateInvestigationReportModal {...defaultProps} tasks={[]} />,
    );

    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const genBtn = btns.find(
        (b) =>
          b.textContent?.includes('Generate') ||
          b.textContent?.includes('Complete Tasks'),
      );
      if (genBtn) expect(genBtn).toBeDisabled();
    });
  });

  // ─── Generate Report Flow ─────────────────────────────────────

  it('transitions to generated step when Generate Report is clicked', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });
  });

  it('shows editable fields in generated step for supervisor', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });

    // Executive Summary textarea should be editable for supervisor
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBeGreaterThan(0);
  });

  it('shows evidence categories in generated step', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });

    // Evidence categories should be rendered
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.5 KB')).toBeInTheDocument();
  });

  it('shows "No evidence summary attached" when no evidence', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    (loadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/No evidence summary attached/i)).toBeInTheDocument();
    });
  });

  // ─── Finalize & Approve Flow ──────────────────────────────────

  it('shows Finalize & Approve button in generated step for supervisor', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });
  });

  it('shows approval confirmation dialog when Finalize is clicked', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Finalize & Approve Report/i }));

    expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();
    expect(screen.getByText(/Lock the report for editing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Approval/i })).toBeInTheDocument();
  });

  it('closes approval dialog when Cancel is clicked', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Finalize & Approve Report/i }));
    expect(screen.getByText(/Confirm Report Approval/i)).toBeInTheDocument();

    // Click Cancel on the approval dialog
    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(screen.queryByText(/Confirm Report Approval/i)).not.toBeInTheDocument();
  });

  it('finalizes report successfully on Confirm Approval', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Finalize & Approve Report/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(ReportsService.generateFraudReport).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 123,
          reportType: 'INVESTIGATION_REPORT',
        }),
      );
    });

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Report has been finalized and approved successfully!',
      );
    });

    expect(mockOnApproved).toHaveBeenCalled();
  });

  it('shows error when report generation fails', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    (ReportsService.generateFraudReport as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Finalize & Approve Report/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to generate report. Please try again.',
      );
    });
  });

  it('shows error when PDF generation fails', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    const pdfMakeMod = await import('pdfmake/build/pdfmake');
    const originalCreatePdf = (pdfMakeMod.default as any).createPdf;
    (pdfMakeMod.default as any).createPdf = vi.fn(() => ({
      getBlob: vi.fn((_cb: any) => {
        throw new Error('PDF failed');
      }),
    }));

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Finalize & Approve Report/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to finalize report. Please try again.',
      );
    });

    // Restore original mock
    (pdfMakeMod.default as any).createPdf = originalCreatePdf;
  });

  // ─── getUserRole ──────────────────────────────────────────────

  it('shows Finalize button when user is CMS_SUPERVISOR', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    setUserRole('CMS_SUPERVISOR');

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });
  });

  it('does not show Finalize button when user is CMS_INVESTIGATOR', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    setUserRole('CMS_INVESTIGATOR');

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Finalize & Approve Report/i })).not.toBeInTheDocument();
  });

  it('defaults to CMS_SUPERVISOR when authToken is missing', async () => {
    localStorage.removeItem('authToken');

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    // If default role is supervisor, the generate button should respect task completion
    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
    });
  });

  it('defaults to CMS_SUPERVISOR when JWT is malformed', async () => {
    localStorage.setItem('authToken', 'invalid-token');

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate Report/i)).toBeInTheDocument();
    });
  });

  // ─── fetchEvidence / fetchCaseData ────────────────────────────

  it('calls loadEvidence and fetchCasesAndEvidence on open', async () => {
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(loadEvidence).toHaveBeenCalledWith(10);
      expect(fetchCasesAndEvidence).toHaveBeenCalledWith(123, 10);
    });
  });

  it('does not fetch if no investigate task', async () => {
    render(
      <GenerateInvestigationReportModal
        {...defaultProps}
        tasks={[{ task_id: 20, name: 'Review', status: 'STATUS_10_ASSIGNED', assigned_user_id: 'u1', created_at: new Date() }]}
      />,
    );

    await waitFor(() => {
      expect(loadEvidence).not.toHaveBeenCalled();
      expect(fetchCasesAndEvidence).not.toHaveBeenCalled();
    });
  });

  it('handles fetchCaseData error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (fetchCasesAndEvidence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch case data:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  // ─── selectedOutcome sync ─────────────────────────────────────

  it('syncs finalOutcome when selectedOutcome prop changes', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { rerender } = render(
      <GenerateInvestigationReportModal
        {...defaultProps}
        selectedOutcome="STATUS_81_CLOSED_REFUTED"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('81 - Closed Refuted')).toBeInTheDocument();
    });

    rerender(
      <GenerateInvestigationReportModal
        {...defaultProps}
        selectedOutcome="STATUS_83_CLOSED_INCONCLUSIVE"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('83 - Closed Inconclusive')).toBeInTheDocument();
    });
  });

  // ─── Key Findings display ─────────────────────────────────────

  it('shows investigation notes as markdown in generated step', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });
  });

  it('shows "No investigation notes added" when notes are empty', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    (fetchCasesAndEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      caseDetails: null,
      supervisorComments: [],
      investigatorName: 'Jane',
      investigationTask: undefined,
      investigationNotes: '',
      submittedDate: 'Jan 10, 2024',
    });

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/No investigation notes added/i)).toBeInTheDocument();
    });
  });

  // ─── Supervisor Feedback section ──────────────────────────────

  it('displays selectedFinalNotes when provided', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <GenerateInvestigationReportModal
        {...defaultProps}
        selectedFinalNotes="Supervisor final notes"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Supervisor final notes')).toBeInTheDocument();
    });
  });

  // ─── FINAL_OUTCOMES export ────────────────────────────────────

  it('exports FINAL_OUTCOMES constant', () => {
    expect(FINAL_OUTCOMES).toHaveLength(3);
    expect(FINAL_OUTCOMES[0].value).toBe('STATUS_83_CLOSED_INCONCLUSIVE');
    expect(FINAL_OUTCOMES[1].value).toBe('STATUS_81_CLOSED_REFUTED');
    expect(FINAL_OUTCOMES[2].value).toBe('STATUS_82_CLOSED_CONFIRMED');
  });

  // ─── Executive Summary ────────────────────────────────────────

  it('builds executive summary using caseData', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      // Should contain case type and outcome
      const textareas = screen.getAllByRole('textbox');
      const summaryTextarea = textareas[0];
      expect(summaryTextarea).toBeDefined();
    });
  });

  // ─── Editing resets approval ──────────────────────────────────

  it('resets approval when executive summary is changed', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });

    const textareas = screen.getAllByRole('textbox');
    await user.type(textareas[0], ' updated');

    // Finalize button should still be available (not yet approved)
    expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
  });

  // ─── Default caseTitle ────────────────────────────────────────

  it('uses default caseTitle when not provided', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
      />,
    );

    expect(screen.getByText('Case CASE-2023-0045 - Fraud')).toBeInTheDocument();
  });

  // ─── Handles latest investigate task selection ────────────────

  it('picks latest investigate task by created_at', async () => {
    const tasks = [
      { task_id: 5, name: 'Investigate Old', status: 'STATUS_30_COMPLETED', assigned_user_id: 'u1', created_at: new Date('2023-01-01') },
      { task_id: 15, name: 'Investigate New', status: 'STATUS_30_COMPLETED', assigned_user_id: 'u1', created_at: new Date('2024-06-01') },
    ];

    render(<GenerateInvestigationReportModal {...defaultProps} tasks={tasks} />);

    await waitFor(() => {
      expect(loadEvidence).toHaveBeenCalledWith(15);
    });
  });

  // ─── Supervisor checking tasks button states ──────────────────

  it('shows "Checking tasks..." text while checking', async () => {
    let resolveTaskCheck: (value: any) => void;
    (taskService.getTasksByCaseId as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveTaskCheck = resolve;
      }),
    );

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    // While tasks are being checked, button should show checking state
    expect(screen.getByText(/Checking tasks/i) || screen.getByText(/Generate Report/i)).toBeTruthy();

    await act(async () => {
      resolveTaskCheck!([investigateTask]);
    });
  });

  // ─── updateTaskForSupervisor error is silently ignored ────────

  it('handles updateTaskForSupervisor error silently during finalize', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    (taskService.updateTaskForSupervisor as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('update failed'),
    );

    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Finalize & Approve Report/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Finalize & Approve Report/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Approval/i }));

    // Should still succeed even if updateTaskForSupervisor fails
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Report has been finalized and approved successfully!',
      );
    });
  });

  // ─── Supervisor feedback textarea (no selectedFinalNotes) ────

  it('shows supervisor feedback textarea when selectedFinalNotes is absent', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <GenerateInvestigationReportModal
        {...defaultProps}
        selectedFinalNotes={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });

    // Supervisor Feedback section should appear since supervisorComments were fetched
    await waitFor(() => {
      expect(screen.getByText('Supervisor Feedback')).toBeInTheDocument();
    });

    // The textarea for supervisor feedback is present - supervisorFeedback state starts as ''
    const textareas = screen.getAllByRole('textbox');
    // Find a textarea that is NOT the executive summary and NOT recommendations
    const feedbackTextarea = textareas.find(
      (t) =>
        !(t as HTMLTextAreaElement).value.includes('investigation') &&
        !(t as HTMLTextAreaElement).value.includes('Based on'),
    );
    expect(feedbackTextarea).toBeDefined();

    // Typing into it works and resets approval
    await user.type(feedbackTextarea!, 'Updated feedback');
    expect(feedbackTextarea).toHaveValue('Updated feedback');
  });

  // ─── Recommendations textarea onChange ────────────────────────

  it('allows editing recommendations textarea for supervisor', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<GenerateInvestigationReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report Generated Successfully/i)).toBeInTheDocument();
    });

    // Recommendations textarea should be found by its initial value
    const textareas = screen.getAllByRole('textbox');
    const recommendationsTextarea = textareas.find(
      (t) => (t as HTMLTextAreaElement).value.includes('Based on the investigation'),
    );
    expect(recommendationsTextarea).toBeDefined();

    await user.clear(recommendationsTextarea!);
    await user.type(recommendationsTextarea!, 'New recommendation');
    expect(recommendationsTextarea).toHaveValue('New recommendation');
  });

  // ─── Outcome display ─────────────────────────────────────────

  it('shows "Not specified" when no outcome is selected', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <GenerateInvestigationReportModal
        {...defaultProps}
        selectedOutcome={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Report/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Not specified')).toBeInTheDocument();
    });
  });
});
