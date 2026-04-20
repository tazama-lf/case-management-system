import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AbandonCaseModal from '../AbandonCaseModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

const mockCaseRow: CaseRow = {
  id: 123,
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_10_ASSIGNED',
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
  alertId: 1,
};

describe('AbandonCaseModal component', () => {
  const renderModal = () => {
    const onClose = vi.fn();
    const onAbandon = vi.fn();

    render(
      <AbandonCaseModal
        open={true}
        onClose={onClose}
        onAbandon={onAbandon}
        caseData={mockCaseRow}
      />,
    );

    return { onClose, onAbandon };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <AbandonCaseModal
        open={false}
        onClose={vi.fn()}
        onAbandon={vi.fn()}
        caseData={mockCaseRow}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the case heading and the disabled submit action initially', () => {
    renderModal();

    expect(
      screen.getByRole('heading', { name: /abandon case/i }),
    ).toBeInTheDocument();
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('renders the case id to provide context to the reviewer', () => {
    renderModal();

    expect(screen.getByText(/case id:/i)).toHaveTextContent('123');
  });

  it('enables submit button when reason is at least 10 characters', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    expect(submitButton).toBeDisabled();

    await user.type(textarea, 'This is a valid reason that is long enough');

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('shows validation error when reason is less than 4 characters', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);

    await user.type(textarea, 'abc');

    await waitFor(() => {
      expect(
        screen.getByText(/reason must be at least 4 characters/i),
      ).toBeInTheDocument();
    });
  });

  it('clears errors when reason becomes valid', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);

    await user.type(textarea, 'abc');

    await waitFor(() => {
      expect(
        screen.getByText(/reason must be at least 4 characters/i),
      ).toBeInTheDocument();
    });

    await user.clear(textarea);
    await user.type(textarea, 'This is a valid reason that is long enough');

    await waitFor(() => {
      expect(
        screen.queryByText(/reason must be at least 4 characters/i),
      ).not.toBeInTheDocument();
    });
  });

  it('submits form with valid reason', async () => {
    const user = userEvent.setup();
    const { onAbandon, onClose } = renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'This is a valid reason that is long enough');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onAbandon).toHaveBeenCalledWith(
        123,
        'This is a valid reason that is long enough',
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles submit error and displays error message', async () => {
    const user = userEvent.setup();
    const { onAbandon } = renderModal();
    const error = new Error('Failed to abandon case');
    onAbandon.mockRejectedValueOnce(error);

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'This is a valid reason that is long enough');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to abandon case')).toBeInTheDocument();
    });
  });

  it('handles submit error with non-Error object', async () => {
    const user = userEvent.setup();
    const { onAbandon } = renderModal();
    onAbandon.mockRejectedValueOnce('String error');

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'This is a valid reason that is long enough');
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to abandon case. Please try again./i),
      ).toBeInTheDocument();
    });
  });

  it('does not submit when caseData is null', async () => {
    const user = userEvent.setup();
    const onAbandon = vi.fn();
    const onClose = vi.fn();

    render(
      <AbandonCaseModal
        open={true}
        onClose={onClose}
        onAbandon={onAbandon}
        caseData={null}
      />,
    );

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'This is a valid reason that is long enough');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onAbandon).not.toHaveBeenCalled();
    });
  });

  it('closes modal and resets form when close button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    await user.type(textarea, 'Some reason text');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('does not close when submitting', async () => {
    const user = userEvent.setup();
    const { onAbandon, onClose } = renderModal();
    onAbandon.mockImplementation(() => new Promise(() => { })); // Never resolves

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'This is a valid reason that is long enough');
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      // Check for the button text specifically
      expect(submitButton.textContent).toContain('Abandoning...');
    });

    // Cancel button should be disabled when submitting
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();

    // onClose should not be called while submitting
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays character count', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    await user.type(textarea, 'Test reason');

    // Character count shows current length / 4 minimum
    expect(screen.getByText(/\/4 characters minimum/i)).toBeInTheDocument();
  });

  it('shows warning message about abandoning case', () => {
    renderModal();

    expect(
      screen.getByText(/This action cannot be undone/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/permanently remove it from active investigation/i),
    ).toBeInTheDocument();
  });

  it('shows note about DRAFT status requirement', () => {
    renderModal();

    expect(
      screen.getByText(/Only cases in DRAFT status can be abandoned/i),
    ).toBeInTheDocument();
  });
});
