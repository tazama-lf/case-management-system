import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RejectCaseCreationModal from '../RejectCaseCreationModal';
import { triageService } from '@/features/alerts';
import type { CaseRow } from '../casesTable.utils';

vi.mock('@/features/alerts', () => ({
  triageService: {
    getAlertById: vi.fn().mockResolvedValue({
      alert_id: 'ALERT-123',
      confidence_per: 85,
      alert_type: 'FRAUD',
      status: 'NALT',
      source: 'Source A',
      priority: 850,
      created_at: '2023-01-01T00:00:00Z',
      message: 'Suspicious transaction detected',
      prediction_outcome: 'FRAUD',
      txtp: 'p2p',
      transaction: { amount: 1000, currency: 'USD' },
    }),
  },
}));

const mockCaseData: CaseRow = {
  id: 123,
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
  statusColor: 'bg-yellow-50',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
  alertId: 456,
};

describe('RejectCaseCreationModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <RejectCaseCreationModal
        open={false}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );
    expect(
      screen.queryByRole('heading', { name: /Reject Case Creation/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render when caseData is null', () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={null}
        onSubmit={mockOnSubmit}
      />,
    );
    expect(
      screen.queryByRole('heading', { name: /Reject Case Creation/i }),
    ).not.toBeInTheDocument();
  });

  it('renders modal with case information when open', () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Reject Case Creation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Case ID: 123/i)).toBeInTheDocument();
    // FRAUD appears multiple times, just check it exists
    expect(screen.getAllByText(/FRAUD/i).length).toBeGreaterThan(0);
  });

  it('displays case details correctly', () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('Case Type')).toBeInTheDocument();
    expect(screen.getByText('Current Status')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Created On')).toBeInTheDocument();
  });

  it('displays alert information when alertId is present', async () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('Associated Alert')).toBeInTheDocument();
    // Wait for async alert fetch to complete
    await screen.findByText('85.00%');
    expect(screen.getByText('85.00%')).toBeInTheDocument();
    // Alert details should show (FRAUD appears multiple times)
    expect(screen.getAllByText('FRAUD').length).toBeGreaterThan(0);
  });

  it('validates rejection reason minimum length', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Case Creation/i,
    });

    // Try to submit with too-short reason (< 4 chars)
    await user.type(textarea, 'ab');
    await user.click(submitButton);

    expect(
      await screen.findByText(
        /Rejection reason must be at least 4 characters/i,
      ),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('enables submit button when reason is valid', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Case Creation/i,
    });

    expect(submitButton).toBeDisabled();

    await user.type(
      textarea,
      'This is a valid rejection reason that is long enough',
    );

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Case Creation/i,
    });

    await user.type(textarea, 'This is a valid rejection reason');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(123, {
        reason: 'This is a valid rejection reason',
      });
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles submission error', async () => {
    const user = userEvent.setup();
    const error = new Error('Submission failed');
    mockOnSubmit.mockRejectedValue(error);

    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Case Creation/i,
    });

    await user.type(textarea, 'This is a valid rejection reason');
    await user.click(submitButton);

    expect(await screen.findByText('Submission failed')).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when X button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const closeButton = screen.getByRole('button', { name: '' }); // Icon button
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Case Creation/i,
    });

    await user.type(textarea, 'This is a valid rejection reason');
    await user.click(submitButton);

    expect(screen.getByText('Rejecting...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('clears errors when user starts typing valid reason', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Case Creation/i,
    });

    // Submit with invalid reason (< 4 chars)
    await user.type(textarea, 'ab');
    await user.click(submitButton);

    expect(
      await screen.findByText(
        /Rejection reason must be at least 4 characters/i,
      ),
    ).toBeInTheDocument();

    // Type valid reason
    await user.clear(textarea);
    await user.type(textarea, 'This is a valid reason');

    await waitFor(() => {
      expect(
        screen.queryByText(/Rejection reason must be at least 4 characters/i),
      ).not.toBeInTheDocument();
    });
  });

  it('shows character count display', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    await user.type(textarea, 'Test');

    expect(screen.getByText('4/4 characters minimum')).toBeInTheDocument();
    expect(screen.getByText('4/500 characters')).toBeInTheDocument();
  });

  it('shows all alert detail fields when alert is loaded', async () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    // Wait for alert to load
    await screen.findByText('85.00%');

    // Alert details fields
    expect(screen.getByText('Source A')).toBeInTheDocument();
    expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
    expect(screen.getByText('Prediction Outcome')).toBeInTheDocument();
  });

  it('shows loading alert indicator when fetching alert', async () => {
    // Make getAlertById slow
    vi.mocked(triageService.getAlertById).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('Loading alert details...')).toBeInTheDocument();
  });

  it('shows "Unable to load alert details" when fetch fails', async () => {
    vi.mocked(triageService.getAlertById).mockRejectedValueOnce(new Error('Network error'));

    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    await screen.findByText('Unable to load alert details');
  });

  it('shows alert ID in the associated alert section', async () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    // alertId section is shown
    expect(screen.getByText('Associated Alert')).toBeInTheDocument();
    // After loading, the Alert ID label appears
    await screen.findByText('Alert ID');
  });

  it('shows transaction data when alertDetails has transaction object', async () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    // Wait for alert fetch to complete
    await screen.findByText('85.00%');

    // Transaction data section renders
    expect(screen.getByText('Transaction Data')).toBeInTheDocument();
  });

  it('shows transaction type field when txtp is present', async () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    await screen.findByText('85.00%');
    expect(screen.getByText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByText('p2p')).toBeInTheDocument();
  });

  it('triggers validation in handleSubmit when reason is too short (form submit)', async () => {
    const user = userEvent.setup();

    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    // Type a reason that is too short (< 4 chars) to make isReasonValid false
    const textarea = screen.getByPlaceholderText(
      /Provide feedback on what needs to be corrected/i,
    );
    await user.type(textarea, 'ab');

    // Submit form directly (bypasses disabled button)
    const form = textarea.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
