import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SuspendCaseModal from '../SuspendCaseModal';
import type { CaseRow } from '../casesTable.utils';

const mockCaseData: CaseRow = {
  id: 'CASE-123',
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_20_IN_PROGRESS',
  statusColor: 'bg-blue-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  action: 'View',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
};

describe('SuspendCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuspend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <SuspendCaseModal
        open={false}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );
    expect(screen.queryByText('Suspend Case')).not.toBeInTheDocument();
  });

  it('renders modal with case information when open', () => {
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Suspend Case/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Case ID: CASE-123/i)).toBeInTheDocument();
  });

  it('displays suspension workflow information', () => {
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    expect(screen.getByText(/Suspension Workflow/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Task status becomes "BLOCKED", case status becomes "SUSPENDED"/i,
      ),
    ).toBeInTheDocument();
  });

  it('validates reason minimum length (10 characters)', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    await user.type(textarea, 'short');
    await user.click(submitButton);

    expect(
      await screen.findByText(/Reason must be at least 10 characters/i),
    ).toBeInTheDocument();
    expect(mockOnSuspend).not.toHaveBeenCalled();
  });

  it('enables submit button when reason is valid', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    expect(submitButton).toBeDisabled();

    await user.type(textarea, 'This is a valid suspension reason');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();
    mockOnSuspend.mockResolvedValue(undefined);

    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    await user.type(textarea, 'This is a valid suspension reason');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuspend).toHaveBeenCalledWith(
        'CASE-123',
        'This is a valid suspension reason',
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockOnSuspend.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <SuspendCaseModal
        open={true}
        onClose={mockOnClose}
        onSuspend={mockOnSuspend}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be suspended/i,
    );
    const submitButton = screen.getByRole('button', { name: /Suspend Case/i });

    await user.type(textarea, 'This is a valid suspension reason');
    await user.click(submitButton);

    expect(screen.getByText('Suspending...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});
