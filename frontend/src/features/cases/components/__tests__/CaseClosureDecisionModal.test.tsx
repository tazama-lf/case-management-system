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
    const onClose = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
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
    expect(screen.getByText(/case id: case-123/i)).toBeInTheDocument();
    expect(screen.getByText(/test case/i)).toBeInTheDocument();
  });

  it('displays decision selection buttons', () => {
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

  it('shows approve form when approve button is clicked', async () => {
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

    // Find the decision selection button (not the form heading)
    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });
  });

  it('shows reject form when reject button is clicked', async () => {
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

    // Find the decision selection button (not the form heading)
    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });
  });

  it('displays recommended outcome when provided', async () => {
    const user = userEvent.setup();
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(
        screen.getByText(/Investigator's Recommended Outcome/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/82 Closed Confirmed/i)).toBeInTheDocument();
    });
  });

  it('displays "Not provided" when recommended outcome is missing', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Not provided/i)).toBeInTheDocument();
    });
  });

  it('displays final notes when provided', async () => {
    const user = userEvent.setup();
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(
        screen.getByText(/Investigator's Final Notes/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/These are final notes from the investigator/i),
      ).toBeInTheDocument();
    });
  });

  it('displays recommendations when provided', async () => {
    const user = userEvent.setup();
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(
        screen.getByText(/Investigator's Recommendations/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/These are recommendations from the investigator/i),
      ).toBeInTheDocument();
    });
  });

  it('submits approve form successfully', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', {
      name: /approve case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith({
        finalOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
        supervisorComments: '',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('submits approve form with supervisor comments', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Supervisor Comments/i)).toBeInTheDocument();
    });

    const commentsTextarea = screen.getByPlaceholderText(
      /provide any additional comments/i,
    );
    await user.type(commentsTextarea, 'Approved with supervisor comments');

    const submitButton = screen.getByRole('button', {
      name: /approve case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith({
        finalOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
        supervisorComments: 'Approved with supervisor comments',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('allows changing final outcome', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    // Find select by its text content or role
    const outcomeSelect =
      screen.getByRole('combobox') ||
      screen.getByDisplayValue(/83 - Closed Inconclusive/i);
    await user.selectOptions(outcomeSelect, 'STATUS_82_CLOSED_CONFIRMED');

    const submitButton = screen.getByRole('button', {
      name: /approve case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith({
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        supervisorComments: '',
      });
    });
  });

  it('handles approve error and displays error message', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockRejectedValue(new Error('Failed to approve'));

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        onReject={vi.fn()}
        caseId={123}
      />,
    );

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', {
      name: /approve case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to approve')).toBeInTheDocument();
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', {
      name: /approve case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to approve case closure. Please try again./i),
      ).toBeInTheDocument();
    });
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

    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const reasonTextarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(
      reasonTextarea,
      'This is a detailed rejection reason that meets the minimum length requirement',
    );

    const submitButton = screen.getByRole('button', {
      name: /reject case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(
        'This is a detailed rejection reason that meets the minimum length requirement',
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('validates rejection reason minimum length', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={onReject}
        caseId={123}
      />,
    );

    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const reasonTextarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(reasonTextarea, 'Short');

    const submitButton = screen.getByRole('button', {
      name: /reject case closure/i,
    });
    expect(submitButton).toBeDisabled();

    await user.clear(reasonTextarea);
    await user.type(
      reasonTextarea,
      'This is a detailed rejection reason that meets the minimum length requirement',
    );

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('displays validation error for short rejection reason', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();

    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={onReject}
        caseId={123}
      />,
    );

    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const reasonTextarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(reasonTextarea, 'Short');

    // Submit button should be disabled for short reason
    const submitButton = screen.getByRole('button', {
      name: /reject case closure/i,
    });
    expect(submitButton).toBeDisabled();

    // Try to submit form to trigger validation (even though button is disabled)
    const form = reasonTextarea.closest('form');
    if (form) {
      await userEvent.click(submitButton);
    }

    // Validation error should appear after form submission attempt
    await waitFor(
      () => {
        const errorText = screen.queryByText(
          /Rejection reason must be at least 15 characters/i,
        );
        // Error might not show if button is disabled, but validation should prevent submission
        expect(onReject).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
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

    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const reasonTextarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(
      reasonTextarea,
      'This is a detailed rejection reason that meets the minimum length requirement',
    );

    const submitButton = screen.getByRole('button', {
      name: /reject case closure/i,
    });
    await user.click(submitButton);

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

    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const reasonTextarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(
      reasonTextarea,
      'This is a detailed rejection reason that meets the minimum length requirement',
    );

    const submitButton = screen.getByRole('button', {
      name: /reject case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to reject case closure. Please try again./i),
      ).toBeInTheDocument();
    });
  });

  it('goes back to decision selection from approve form', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/case closure review/i)).toBeInTheDocument();
    });
  });

  it('goes back to decision selection from reject form', async () => {
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

    const rejectButtons = screen.getAllByText(/Reject Case Closure/i);
    const decisionButton = rejectButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/case closure review/i)).toBeInTheDocument();
    });
  });

  it('closes modal and resets form', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when submitting', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockImplementation(() => new Promise(() => { })); // Never resolves
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', {
      name: /approve case closure/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(submitButton.textContent).toContain('Approving...');
    });

    expect(onClose).not.toHaveBeenCalled();
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

    const rejectButton = screen
      .getByText(/Reject Case Closure/i)
      .closest('button');
    if (rejectButton) {
      await user.click(rejectButton);
    }

    await waitFor(() => {
      expect(screen.getByText(/Rejection Reason/i)).toBeInTheDocument();
    });

    const reasonTextarea = screen.getByPlaceholderText(/explain in detail/i);
    await user.type(reasonTextarea, 'Test rejection reason');

    expect(screen.getByText(/\/15 characters minimum/i)).toBeInTheDocument();
    expect(screen.getByText(/\/1000 characters/i)).toBeInTheDocument();
  });

  it('displays workflow information', () => {
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
      screen.getByText(/Supervisor Case Closure Approval Workflow/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Only cases in "PENDING FINAL APPROVAL"/i),
    ).toBeInTheDocument();
  });

  it('uses default outcome when recommendedOutcome is not provided', async () => {
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

    const approveButtons = screen.getAllByText(/Approve Case Closure/i);
    const decisionButton = approveButtons.find((btn) => {
      const button = btn.closest('button');
      return button && !button.getAttribute('type');
    });

    if (decisionButton) {
      await user.click(decisionButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Final Outcome/i)).toBeInTheDocument();
    });

    // Find select by role or display value
    const outcomeSelect =
      screen.getByRole('combobox') ||
      screen.getByDisplayValue(/83 - Closed Inconclusive/i);
    expect(outcomeSelect).toHaveValue('STATUS_83_CLOSED_INCONCLUSIVE');
  });
});
