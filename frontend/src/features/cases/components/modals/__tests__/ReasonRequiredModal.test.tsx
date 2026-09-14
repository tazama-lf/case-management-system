import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReasonRequiredModal from '../ReasonRequiredModal';

describe('ReasonRequiredModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    title: 'Revoke Access',
    icon: <span>icon</span>,
    confirmLabel: 'Revoke Access',
    confirmingLabel: 'Revoking…',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(<ReasonRequiredModal {...defaultProps} open={false} />);
    expect(
      screen.queryByRole('heading', { name: 'Revoke Access' }),
    ).not.toBeInTheDocument();
  });

  it('renders title, subtitle and description when open', () => {
    render(
      <ReasonRequiredModal
        {...defaultProps}
        subtitle="user-123"
        description="This removes access."
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Revoke Access' }),
    ).toBeInTheDocument();
    expect(screen.getByText('user-123')).toBeInTheDocument();
    expect(screen.getByText('This removes access.')).toBeInTheDocument();
  });

  it('disables the confirm button until a reason is entered', async () => {
    const user = userEvent.setup();
    render(<ReasonRequiredModal {...defaultProps} />);

    const confirmButton = screen.getByRole('button', { name: 'Revoke Access' });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Reason/), 'Conflict of interest');
    expect(confirmButton).toBeEnabled();
  });

  it('does not submit a whitespace-only reason', async () => {
    const user = userEvent.setup();
    render(<ReasonRequiredModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/Reason/), '   ');
    expect(
      screen.getByRole('button', { name: 'Revoke Access' }),
    ).toBeDisabled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with the trimmed reason and closes on success', async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockResolvedValueOnce(undefined);
    render(<ReasonRequiredModal {...defaultProps} />);

    await user.type(
      screen.getByLabelText(/Reason/),
      '  Conflict of interest  ',
    );
    await user.click(screen.getByRole('button', { name: 'Revoke Access' }));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith('Conflict of interest');
    });
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('stays open and does not clear the reason if onConfirm rejects', async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockRejectedValueOnce(new Error('network error'));
    render(<ReasonRequiredModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/Reason/), 'Conflict of interest');
    await user.click(screen.getByRole('button', { name: 'Revoke Access' }));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalled();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked, without calling onConfirm', async () => {
    const user = userEvent.setup();
    render(<ReasonRequiredModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
