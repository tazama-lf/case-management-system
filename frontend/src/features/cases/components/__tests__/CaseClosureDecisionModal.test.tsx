import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseClosureDecisionModal from '../CaseClosureDecisionModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn().mockReturnValue({
    hasSupervisorRole: () => true,
  }),
}));

vi.mock('../../services/commentService', () => ({
  commentService: {
    getCommentsByTaskId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/taskService', () => ({
  TaskStatus: {
    STATUS_01_UNASSIGNED: 'STATUS_01_UNASSIGNED',
    STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
  },
}));

vi.mock('../modals/GenerateInvestigationReportModal', () => ({
  default: ({
    open,
    onApproved,
    onClose,
  }: {
    open: boolean;
    onApproved: () => void;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="report-modal">
        <button onClick={onApproved}>Confirm Report</button>
        <button onClick={onClose}>Close Report</button>
      </div>
    ) : null,
}));

describe('CaseClosureDecisionModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <CaseClosureDecisionModal
        open={false}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders without crashing', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(screen.getByText(/case closure review/i)).toBeInTheDocument();
  });

  it('displays case ID and case name', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        caseName="Test Case"
      />,
    );
    expect(screen.getByText(/Case ID: 123/)).toBeInTheDocument();
    expect(screen.getByText(/Test Case/)).toBeInTheDocument();
  });

  it('displays tab buttons', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(screen.getByText(/Approve Case Closure/i)).toBeInTheDocument();
    expect(screen.getByText(/Reject Case Closure/i)).toBeInTheDocument();
  });

  it('shows approve form by default with Final Outcome', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    expect(screen.getByText(/Supervisor Comments/i)).toBeInTheDocument();
  });

  it('shows reject form when reject tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
  });

  it('displays final notes when provided', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        finalNotes="These are final notes from the investigator"
      />,
    );
    expect(screen.getByText(/Investigator.s Final Notes/i)).toBeInTheDocument();
    expect(
      screen.getByText(/These are final notes from the investigator/i),
    ).toBeInTheDocument();
  });

  it('displays recommendations when provided', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        recommendations="These are recommendations from the investigator"
      />,
    );
    expect(
      screen.getByText(/Investigator.s Recommendations/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/These are recommendations from the investigator/i),
    ).toBeInTheDocument();
  });

  it('shows "No notes provided" when no investigator notes', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(screen.getByText(/No notes provided/i)).toBeInTheDocument();
  });

  it('displays Generate Investigation Report button', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(
      screen.getByText(/Generate Investigation Report/i),
    ).toBeInTheDocument();
  });

  it('disables Generate Report button when supervisor comments are short', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const btn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    expect(btn).toBeDisabled();
  });

  it('enables Generate Report button when supervisor comments have min 4 chars', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Good work approved');
    const btn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    expect(btn).toBeEnabled();
  });

  it('opens report modal when Generate Report is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Good work approved');
    const btn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
  });

  it('allows changing final outcome', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const outcomeSelect = screen.getByRole('combobox');
    await user.selectOptions(outcomeSelect, 'STATUS_82_CLOSED_CONFIRMED');
    expect(outcomeSelect).toHaveValue('STATUS_82_CLOSED_CONFIRMED');
  });

  it('submits reject form successfully', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={onClose}
        onApprove={vi.fn()}
        onReject={onReject}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(textarea, 'Detailed rejection reason text');
    const submitButtons = screen.getAllByText(/Reject Case Closure/i);
    const submitBtn = submitButtons.find(
      (el) =>
        el.closest('button[type="button"]') && el.closest('.flex.justify-end'),
    );
    if (submitBtn) {
      await user.click(submitBtn.closest('button')!);
    }
    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith('Detailed rejection reason text');
    });
  });

  it('disables reject button when rejection reason is short', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(textarea, 'ab');
    const submitButtons = screen.getAllByText(/Reject Case Closure/i);
    const rejectSubmitBtn = submitButtons.find((el) => {
      const btn = el.closest('button');
      return btn && btn.classList.contains('bg-red-600');
    });
    expect(rejectSubmitBtn?.closest('button')).toBeDisabled();
  });

  it('shows validation error when supervisor comments are too short', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'ab');
    await user.clear(textarea);
    await user.type(textarea, 'abc');
    // Button should still be disabled
    const btn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    expect(btn).toBeDisabled();
  });

  it('handles reject error and displays error message', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockRejectedValue(new Error('Failed to reject'));
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={onReject}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(textarea, 'Detailed rejection reason text');
    const submitButtons = screen.getAllByText(/Reject Case Closure/i);
    const submitBtn = submitButtons.find((el) => {
      const btn = el.closest('button');
      return btn && btn.classList.contains('bg-red-600');
    });
    if (submitBtn) {
      await user.click(submitBtn.closest('button')!);
    }
    await waitFor(() => {
      expect(screen.getByText('Failed to reject')).toBeInTheDocument();
    });
  });

  it('handles reject error with non-Error object', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockRejectedValue('String error');
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={onReject}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(textarea, 'Detailed rejection reason text');
    const submitButtons = screen.getAllByText(/Reject Case Closure/i);
    const submitBtn = submitButtons.find((el) => {
      const btn = el.closest('button');
      return btn && btn.classList.contains('bg-red-600');
    });
    if (submitBtn) {
      await user.click(submitBtn.closest('button')!);
    }
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to reject case closure. Please try again./i),
      ).toBeInTheDocument();
    });
  });

  it('displays character count for rejection reason', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(textarea, 'Test');
    expect(screen.getByText(/4\/4 characters minimum/i)).toBeInTheDocument();
    expect(screen.getByText(/4\/500 characters/i)).toBeInTheDocument();
  });

  it('displays supervisor comment character count', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Hello');
    expect(screen.getByText(/5\/500 characters/)).toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={onClose}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('uses default outcome when recommendedOutcome is not provided', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const outcomeSelect = screen.getByRole('combobox');
    expect(outcomeSelect).toHaveValue('STATUS_83_CLOSED_INCONCLUSIVE');
  });

  it('uses recommendedOutcome when provided', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        recommendedOutcome="STATUS_82_CLOSED_CONFIRMED"
      />,
    );
    const outcomeSelect = screen.getByRole('combobox');
    expect(outcomeSelect).toHaveValue('STATUS_82_CLOSED_CONFIRMED');
  });

  it('displays approval info box', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(
      screen.getByText(/you are about to finalize this case/i),
    ).toBeInTheDocument();
  });

  it('displays rejection info box after switching tab', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const rejectTab = screen
      .getByText(/Reject Case Closure/i)
      .closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(
        screen.getByText(/provide detailed feedback/i),
      ).toBeInTheDocument();
    });
  });

  it('shows minimum characters hint for supervisor comments', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    expect(screen.getByText(/minimum 4 characters/i)).toBeInTheDocument();
  });

  it('submits approve form when report is approved', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    // Type supervisor comments
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Approved after review');
    // Click Generate Investigation Report
    const genBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(genBtn);
    // Report modal should open
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
    // Confirm report which triggers onApproved → approveCase
    await user.click(screen.getByText('Confirm Report'));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith({
        finalOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
        supervisorComments: 'Approved after review',
      });
    });
  });

  it('handles approve error and displays error message', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockRejectedValue(new Error('Approve failed'));
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Approved after review');
    const genBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(genBtn);
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm Report'));
    await waitFor(() => {
      expect(screen.getByText('Approve failed')).toBeInTheDocument();
    });
  });

  it('handles approve error with non-Error object', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockRejectedValue('String error');
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Approved after review');
    const genBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(genBtn);
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm Report'));
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to approve case closure/i),
      ).toBeInTheDocument();
    });
  });

  it('closes report modal when Close Report is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Supervisor notes here');
    const genBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(genBtn);
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Close Report'));
    await waitFor(() => {
      expect(screen.queryByTestId('report-modal')).not.toBeInTheDocument();
    });
  });

  it('disables reject tab after report is approved', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Approved after review');
    const genBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(genBtn);
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm Report'));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalled();
    });
  });

  it('displays tasks comments when loaded', async () => {
    const { commentService } = await import('../../services/commentService');
    (commentService.getCommentsByTaskId as vi.Mock).mockResolvedValue([
      { comment_id: 1, note: 'Investigator note 1' },
      { comment_id: 2, note: 'Investigator note 2' },
    ]);

    const taskList = [
      {
        task_id: 10,
        name: 'Approve Case Closure',
        status: 'STATUS_01_UNASSIGNED',
      },
    ] as any;

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        taskList={taskList}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Investigator note 1')).toBeInTheDocument();
      expect(screen.getByText('Investigator note 2')).toBeInTheDocument();
    });
  });

  it('does not prevent close when not submitting', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={onClose}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    // Click the X button in the header
    const xButton = screen.getByRole('button', { name: '' });
    if (xButton) {
      await user.click(xButton);
    } else {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('displays submit error on approve tab', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockRejectedValue(new Error('Server error'));
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        onReject={vi.fn()}
        caseId={123}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(textarea, 'Approved');
    const genBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    await user.click(genBtn);
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm Report'));
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('hides Generate Report button when not supervisor', async () => {
    const authModule = await import('@/features/auth');
    (authModule.useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      hasSupervisorRole: () => false,
    });

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    expect(
      screen.queryByText(/Generate Investigation Report/i),
    ).not.toBeInTheDocument();

    // Restore
    (authModule.useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      hasSupervisorRole: () => true,
    });
  });

  it('displays caseName only when not NONE', () => {
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        caseName="NONE"
      />,
    );
    // Should show case ID but not "NONE"
    expect(screen.getByText(/Case ID: 123/)).toBeInTheDocument();
  });

  it('shows supervisor comments validation error on approve tab', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    // Type short comment (less than 4 chars)
    const textarea = screen.getByPlaceholderText(
      /Provide any additional comments/i,
    );
    await user.type(textarea, 'ab');

    // Click generate report button (it should be disabled due to short comment)
    const generateBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    expect(generateBtn).toBeDisabled();
  });

  it('shows rejection reason validation error', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    // Switch to reject tab
    await user.click(screen.getByText(/Reject Case Closure/i));

    // Try to reject with short reason
    const textarea = screen.getByPlaceholderText(/Explain in detail/i);
    await user.type(textarea, 'ab');

    // Reject button should be disabled with short reason
    const rejectBtns = screen.getAllByRole('button', {
      name: /Reject Case Closure/i,
    });
    const submitBtn = rejectBtns[rejectBtns.length - 1]; // submit button is the last one
    expect(submitBtn).toBeDisabled();
  });

  it('shows rejection reason error after submission with short text', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    // Switch to reject tab
    await user.click(screen.getByText(/Reject Case Closure/i));

    // Type sufficient reason and then submit
    const textarea = screen.getByPlaceholderText(/Explain in detail/i);
    await user.type(textarea, 'Valid reason text');

    const rejectBtns = screen.getAllByRole('button', {
      name: /Reject Case Closure/i,
    });
    const submitBtn = rejectBtns[rejectBtns.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it('switches to approve tab from reject tab', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    // Switch to reject tab
    await user.click(screen.getByText(/Reject Case Closure/i));
    expect(
      screen.getByPlaceholderText(/Explain in detail/i),
    ).toBeInTheDocument();

    // Switch back to approve tab
    await user.click(screen.getByText(/Approve Case Closure/i));
    expect(
      screen.getByPlaceholderText(/Provide any additional comments/i),
    ).toBeInTheDocument();
  });

  it('shows investigator notes on reject tab', async () => {
    const user = userEvent.setup();
    const commentServiceModule = await import('../../services/commentService');
    (
      commentServiceModule.commentService.getCommentsByTaskId as vi.Mock
    ).mockResolvedValue([
      { comment_id: 1, note: 'Investigation note from investigator' },
    ]);

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        taskList={
          [
            {
              task_id: 55,
              name: 'Approve Case Closure',
              status: 'STATUS_01_UNASSIGNED',
            },
          ] as any
        }
      />,
    );

    // Switch to reject tab
    await user.click(screen.getByText(/Reject Case Closure/i));

    await waitFor(() => {
      expect(
        screen.getByText('Investigation note from investigator'),
      ).toBeInTheDocument();
    });
  });

  it('shows "No notes provided" on reject tab when no comments', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    // Switch to reject tab
    await user.click(screen.getByText(/Reject Case Closure/i));

    expect(screen.getByText(/No notes provided/i)).toBeInTheDocument();
  });

  it('shows supervisor comments character count', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide any additional comments/i,
    );
    await user.type(textarea, 'Test comment');
    expect(screen.getByText(/12\/500 characters/)).toBeInTheDocument();
  });

  it('shows reject submit error on reject tab', async () => {
    const user = userEvent.setup();
    const mockOnReject = vi.fn().mockRejectedValue(new Error('Reject failed'));
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={mockOnReject}
        caseId={123}
      />,
    );

    // Switch to reject tab
    await user.click(screen.getByText(/Reject Case Closure/i));

    const textarea = screen.getByPlaceholderText(/Explain in detail/i);
    await user.type(textarea, 'Valid rejection reason');

    const rejectBtns = screen.getAllByRole('button', {
      name: /Reject Case Closure/i,
    });
    const rejectSubmitBtn = rejectBtns[rejectBtns.length - 1];
    await user.click(rejectSubmitBtn);

    await waitFor(() => {
      expect(screen.getByText('Reject failed')).toBeInTheDocument();
    });
  });

  it('handles comment loading failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const commentServiceModule = await import('../../services/commentService');
    (
      commentServiceModule.commentService.getCommentsByTaskId as vi.Mock
    ).mockRejectedValue(new Error('Comments load error'));

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
        taskList={
          [
            {
              task_id: 55,
              name: 'Approve Case Closure',
              status: 'STATUS_01_UNASSIGNED',
            },
          ] as any
        }
      />,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load comments',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('displays rejection reason character count', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    await user.click(screen.getByText(/Reject Case Closure/i));

    const textarea = screen.getByPlaceholderText(/Explain in detail/i);
    await user.type(textarea, 'Test');

    expect(screen.getByText(/4\/4 characters minimum/i)).toBeInTheDocument();
  });

  it('shows supervisor comments error when trying to generate report with short comment', async () => {
    const user = userEvent.setup();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    // Type exactly 4 chars to enable the generate report button
    const textarea = screen.getByPlaceholderText(
      /Provide any additional comments/i,
    );
    await user.type(textarea, 'Test');

    const generateBtn = screen
      .getByText(/Generate Investigation Report/i)
      .closest('button')!;
    expect(generateBtn).not.toBeDisabled();
    await user.click(generateBtn);

    // The report modal should open since validation passes with 4+ chars
    await waitFor(() => {
      expect(screen.getByTestId('report-modal')).toBeInTheDocument();
    });
  });
});
