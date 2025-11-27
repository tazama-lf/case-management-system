import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApproveCaseReopenModal from '../ApproveCaseReopenModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ApproveCaseReopenModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <ApproveCaseReopenModal
        open={false}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        caseId="CASE-123"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders without crashing', () => {
    const onClose = vi.fn();
    const onApprove = vi.fn();
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );
    expect(screen.getByText(/approve case reopen/i)).toBeInTheDocument();
  });

  it('displays case ID', () => {
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        caseId="CASE-123"
      />,
    );
    expect(screen.getByText(/case id: case-123/i)).toBeInTheDocument();
  });

  it('displays requester role when provided - ANALYST', () => {
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        caseId="CASE-123"
        requesterRole="ANALYST"
      />,
    );
    expect(screen.getByText(/requested by: analyst/i)).toBeInTheDocument();
  });

  it('displays requester role when provided - SUPERVISOR', () => {
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        caseId="CASE-123"
        requesterRole="SUPERVISOR"
      />,
    );
    expect(screen.getByText(/requested by: supervisor/i)).toBeInTheDocument();
  });

  it('does not display requester role when not provided', () => {
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        caseId="CASE-123"
      />,
    );
    expect(screen.queryByText(/requested by:/i)).not.toBeInTheDocument();
  });

  it('submits form without comments', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('CASE-123', undefined);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('submits form with comments', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const textarea = screen.getByPlaceholderText(/add any context/i);
    await user.type(textarea, 'Approved with additional context');

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('CASE-123', 'Approved with additional context');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('trims comments before submitting', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const textarea = screen.getByPlaceholderText(/add any context/i);
    await user.type(textarea, '  Trimmed comment  ');

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('CASE-123', 'Trimmed comment');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles submit error and displays error message', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockRejectedValue(new Error('Failed to approve'));

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to approve')).toBeInTheDocument();
    });
  });

  it('handles submit error with non-Error object', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockRejectedValue('String error');

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to approve case reopening/i),
      ).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={vi.fn()}
        caseId="CASE-123"
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when submitting', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/approving.../i)).toBeInTheDocument();
    });
  });

  it('displays workflow information', () => {
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        caseId="CASE-123"
      />,
    );

    expect(
      screen.getByText(/Reopening Workflow/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Case must be in "PENDING CASE REOPENING APPROVAL"/i),
    ).toBeInTheDocument();
  });

  it('clears comments after successful submission', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );

    const textarea = screen.getByPlaceholderText(/add any context/i);
    await user.type(textarea, 'Test comment');

    const submitButton = screen.getByRole('button', {
      name: /approve reopening/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
