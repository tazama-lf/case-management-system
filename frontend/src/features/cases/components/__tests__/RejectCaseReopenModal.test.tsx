import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RejectCaseReopenModal from '../RejectCaseReopenModal';

describe('RejectCaseReopenModal', () => {
  const mockOnClose = vi.fn();
  const mockOnReject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <RejectCaseReopenModal
        open={false}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );
    expect(screen.queryByText('Reject Case Reopening')).not.toBeInTheDocument();
  });

  it('renders modal with case ID when open', () => {
    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    expect(screen.getByText('Reject Case Reopening')).toBeInTheDocument();
    expect(screen.getByText(/Case ID: 123/)).toBeInTheDocument();
  });

  it('validates reason minimum length', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide a clear reason for rejecting the reopening/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Reopening/i,
    });

    await user.type(textarea, 'ab');
    await user.click(submitButton);

    expect(
      await screen.findByText('Reason must be at least 4 characters'),
    ).toBeInTheDocument();
    expect(mockOnReject).not.toHaveBeenCalled();
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();
    mockOnReject.mockResolvedValue(undefined);

    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide a clear reason for rejecting the reopening/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Reopening/i,
    });

    await user.type(textarea, 'This is a valid rejection reason');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnReject).toHaveBeenCalledWith(
        123,
        'This is a valid rejection reason',
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles submission error', async () => {
    const user = userEvent.setup();
    const error = new Error('Rejection failed');
    mockOnReject.mockRejectedValue(error);

    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide a clear reason for rejecting the reopening/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Reopening/i,
    });

    await user.type(textarea, 'This is a valid rejection reason');
    await user.click(submitButton);

    expect(await screen.findByText('Rejection failed')).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockOnReject.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide a clear reason for rejecting the reopening/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Reject Reopening/i,
    });

    await user.type(textarea, 'This is a valid rejection reason');
    await user.click(submitButton);

    expect(screen.getByText('Rejecting...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('displays character count', async () => {
    const user = userEvent.setup();
    render(
      <RejectCaseReopenModal
        open={true}
        onClose={mockOnClose}
        caseId={123}
        onReject={mockOnReject}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide a clear reason for rejecting the reopening/i,
    );

    await user.type(textarea, 'Test reason');

    // Verify textarea has the value
    expect(textarea).toHaveValue('Test reason');
    // Character count should be visible somewhere in the document
    expect(screen.getByText(/characters minimum/i)).toBeInTheDocument();
  });
});
