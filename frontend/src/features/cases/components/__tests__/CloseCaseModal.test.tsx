import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloseCaseModal from '../CloseCaseModal';
import { vi, describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/auth', () => ({
  authService: {
    getUser: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: vi.fn((status: string) => status),
}));

vi.mock('../modals/GenerateInvestigationReportModal', () => ({
  default: () => null,
}));

describe('CloseCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    caseId: 'CASE-123',
    caseName: 'Test Case',
    onSubmit: mockOnSubmit,
  };

  it('renders correctly when open', () => {
    render(<CloseCaseModal {...defaultProps} />);
    expect(screen.getByText('Complete Case Investigation')).toBeInTheDocument();
    expect(screen.getByText(/CASE-123/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CloseCaseModal {...defaultProps} open={false} />);
    expect(
      screen.queryByText('Complete Case Investigation'),
    ).not.toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<CloseCaseModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Final investigation notes are required'),
    ).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);

    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Investigation completed successfully.');

    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    await user.click(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendedOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
        finalNotes: 'Investigation completed successfully.',
      }),
    );
  });

  it('handles submission error', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValueOnce(new Error('Submission failed'));
    render(<CloseCaseModal {...defaultProps} />);

    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid notes for error test.');

    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    await user.click(submitBtn);

    expect(await screen.findByText('Submission failed')).toBeInTheDocument();
  });
});
