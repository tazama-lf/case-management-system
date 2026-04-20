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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
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
    expect(screen.getByText(/These are final notes from the investigator/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Investigator.s Recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/These are recommendations from the investigator/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Generate Investigation Report/i)).toBeInTheDocument();
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
    const btn = screen.getByText(/Generate Investigation Report/i).closest('button')!;
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
    const textarea = screen.getByPlaceholderText(/provide any additional comments/i);
    await user.type(textarea, 'Good work approved');
    const btn = screen.getByText(/Generate Investigation Report/i).closest('button')!;
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
    const textarea = screen.getByPlaceholderText(/provide any additional comments/i);
    await user.type(textarea, 'Good work approved');
    const btn = screen.getByText(/Generate Investigation Report/i).closest('button')!;
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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(textarea, 'Detailed rejection reason text');
    const submitButtons = screen.getAllByText(/Reject Case Closure/i);
    const submitBtn = submitButtons.find((el) => el.closest('button[type="button"]') && el.closest('.flex.justify-end'));
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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
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
    const textarea = screen.getByPlaceholderText(/provide any additional comments/i);
    await user.type(textarea, 'ab');
    await user.clear(textarea);
    await user.type(textarea, 'abc');
    // Button should still be disabled
    const btn = screen.getByText(/Generate Investigation Report/i).closest('button')!;
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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
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
      expect(screen.getByText(/Failed to reject case closure. Please try again./i)).toBeInTheDocument();
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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
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
    const textarea = screen.getByPlaceholderText(/provide any additional comments/i);
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
    expect(screen.getByText(/you are about to finalize this case/i)).toBeInTheDocument();
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
    const rejectTab = screen.getByText(/Reject Case Closure/i).closest('button')!;
    await user.click(rejectTab);
    await waitFor(() => {
      expect(screen.getByText(/provide detailed feedback/i)).toBeInTheDocument();
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
});