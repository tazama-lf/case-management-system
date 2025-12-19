import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResumeCaseModal from '../ResumeCaseModal';
import type { CaseRow } from '../casesTable.utils';

const mockCaseData: CaseRow = {
  id: 'CASE-123',
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_21_SUSPENDED',
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
};

describe('ResumeCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnResume = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <ResumeCaseModal
        open={false}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );
    expect(screen.queryByText('Resume Case')).not.toBeInTheDocument();
  });

  it('renders modal with case information when open', () => {
    render(
      <ResumeCaseModal
        open={true}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );

    expect(screen.getByRole('heading', { name: /Resume Case/i })).toBeInTheDocument();
    expect(screen.getByText(/Case ID: CASE-123/i)).toBeInTheDocument();
  });

  it('displays resumption information', () => {
    render(
      <ResumeCaseModal
        open={true}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );

    expect(
      screen.getByText(/Resuming this case will move it back to "In Progress" status/i),
    ).toBeInTheDocument();
  });

  it('validates reason minimum length (5 characters)', async () => {
    const user = userEvent.setup();
    render(
      <ResumeCaseModal
        open={true}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be resumed/i,
    );
    const submitButton = screen.getByRole('button', { name: /Resume Case/i });

    await user.type(textarea, 'test');
    expect(submitButton).toBeDisabled();

    await user.type(textarea, 't'); // Now 5 characters
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();
    mockOnResume.mockResolvedValue(undefined);

    render(
      <ResumeCaseModal
        open={true}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be resumed/i,
    );
    const submitButton = screen.getByRole('button', { name: /Resume Case/i });

    await user.type(textarea, 'This is a valid reason');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnResume).toHaveBeenCalledWith(
        'CASE-123',
        'This is a valid reason',
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ResumeCaseModal
        open={true}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockOnResume.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <ResumeCaseModal
        open={true}
        onClose={mockOnClose}
        onResume={mockOnResume}
        caseData={mockCaseData}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Explain why this case needs to be resumed/i,
    );
    const submitButton = screen.getByRole('button', { name: /Resume Case/i });

    await user.type(textarea, 'Valid reason');
    await user.click(submitButton);

    expect(screen.getByText('Resuming...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});

