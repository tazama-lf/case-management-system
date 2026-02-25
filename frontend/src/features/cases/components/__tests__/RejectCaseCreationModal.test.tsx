import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RejectCaseCreationModal from '../RejectCaseCreationModal';
import type { CaseRow } from '../casesTable.utils';

const mockCaseData: CaseRow = {
  id: 'CASE-123',
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
  statusColor: 'bg-yellow-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  action: 'View',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
  alertId: 'ALERT-123',
  confidencePercent: 85,
  alertMessage: 'Suspicious transaction detected',
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
    expect(screen.getByText(/Case ID: CASE-123/i)).toBeInTheDocument();
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

  it('displays alert information when alertId is present', () => {
    render(
      <RejectCaseCreationModal
        open={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText('Associated Alert')).toBeInTheDocument();
    expect(screen.getByText('ALERT-123')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
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

    // Try to submit with short reason
    await user.type(textarea, 'short');
    await user.click(submitButton);

    expect(
      await screen.findByText(
        /Rejection reason must be at least 10 characters/i,
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
      expect(mockOnSubmit).toHaveBeenCalledWith('CASE-123', {
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

    // Submit with invalid reason
    await user.type(textarea, 'short');
    await user.click(submitButton);

    expect(
      await screen.findByText(
        /Rejection reason must be at least 10 characters/i,
      ),
    ).toBeInTheDocument();

    // Type valid reason
    await user.clear(textarea);
    await user.type(textarea, 'This is a valid reason');

    await waitFor(() => {
      expect(
        screen.queryByText(/Rejection reason must be at least 10 characters/i),
      ).not.toBeInTheDocument();
    });
  });
});
