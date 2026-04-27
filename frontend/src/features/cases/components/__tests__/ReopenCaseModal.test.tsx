import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReopenCaseModal from '../ReopenCaseModal';
import type { CaseRow } from '../casesTable.utils';

vi.mock('@/features/auth', () => ({
  authService: {
    getUser: vi.fn().mockReturnValue(null),
  },
}));

const mockCaseData: CaseRow = {
  id: 123,
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_82_CLOSED_CONFIRMED',
  statusColor: 'bg-gray-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  action: 'View',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
  alertId: 1,
};

describe('ReopenCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnReopen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <ReopenCaseModal
        open={false}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );
    expect(screen.queryByText('Reopen Case')).not.toBeInTheDocument();
  });

  it('renders modal with case information when open', () => {
    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    expect(screen.getByText('Reopen Case')).toBeInTheDocument();
    expect(screen.getByText(/Case ID: 123/)).toBeInTheDocument();
  });

  it('displays reopening information', () => {
    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    expect(
      screen.getByText(/Request reopening of a previously closed case/i),
    ).toBeInTheDocument();
  });

  it('validates reason minimum length', async () => {
    const user = userEvent.setup();
    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide detailed justification for reopening this case/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Request Case Reopening/i,
    });

    await user.type(textarea, 'ab');

    expect(
      screen.getByText(/Reason must be at least 4 characters/i),
    ).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when reason is valid', async () => {
    const user = userEvent.setup();
    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide detailed justification for reopening this case/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Request Case Reopening/i,
    });

    expect(submitButton).toBeDisabled();

    await user.type(textarea, 'This is a valid reopening reason');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();
    mockOnReopen.mockResolvedValue(undefined);

    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide detailed justification for reopening this case/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Request Case Reopening/i,
    });

    await user.type(textarea, 'This is a valid reopening reason');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnReopen).toHaveBeenCalledWith(
        123,
        'This is a valid reopening reason',
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles submission error gracefully', async () => {
    const user = userEvent.setup();
    const error = new Error('Reopening failed');
    mockOnReopen.mockRejectedValue(error);

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide detailed justification for reopening this case/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Request Case Reopening/i,
    });

    await user.type(textarea, 'This is a valid reopening reason');
    await user.click(submitButton);

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockOnReopen.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide detailed justification for reopening this case/i,
    );
    const submitButton = screen.getByRole('button', {
      name: /Request Case Reopening/i,
    });

    await user.type(textarea, 'This is a valid reopening reason');
    await user.click(submitButton);

    expect(screen.getByText('Requesting Reopening...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('displays character count', async () => {
    const user = userEvent.setup();
    render(
      <ReopenCaseModal
        open={true}
        onClose={mockOnClose}
        onReopen={mockOnReopen}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Provide detailed justification for reopening this case/i,
    );

    await user.type(textarea, 'Test reason');

    // Verify textarea has the value
    expect(textarea).toHaveValue('Test reason');
    // Character count should be visible somewhere in the document
    expect(screen.getByText(/characters minimum/i)).toBeInTheDocument();
  });
});
