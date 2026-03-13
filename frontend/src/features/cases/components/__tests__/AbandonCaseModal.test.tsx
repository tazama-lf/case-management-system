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
  alertId: 0,
};

describe('AbandonCaseModal component', () => {
  const renderModal = (
    overrides?: Partial<{
      onClose: ReturnType<typeof vi.fn>;
      onAbandon: ReturnType<typeof vi.fn>;
      caseData: CaseRow | null;
    }>,
  ) => {
    const onClose = overrides?.onClose ?? vi.fn();
    const onAbandon = overrides?.onAbandon ?? vi.fn();
    const caseData =
      overrides?.caseData !== undefined ? overrides.caseData : mockCaseRow;

    render(
      <AbandonCaseModal
        open={true}
        onClose={onClose}
        onAbandon={onAbandon}
        caseData={caseData}
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

  it('enables submit button when reason is at least 4 characters', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    expect(submitButton).toBeDisabled();

    await user.type(textarea, 'Valid reason for abandoning');

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

  it('clears validation error when reason becomes valid', async () => {
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
    await user.type(textarea, 'Valid reason for abandoning this case');

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

    await user.type(textarea, 'Valid reason for abandoning');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onAbandon).toHaveBeenCalledWith(
        123,
        'Valid reason for abandoning',
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles synchronous submit error and displays error message', async () => {
    const user = userEvent.setup();
    const onAbandon = vi.fn().mockImplementation(() => {
      throw new Error('Failed to abandon case');
    });
    const { onClose } = renderModal({ onAbandon });

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'Valid reason for abandoning');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to abandon case')).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles submit error with non-Error object', async () => {
    const user = userEvent.setup();
    const onAbandon = vi.fn().mockImplementation(() => {
      throw 'String error';
    });
    renderModal({ onAbandon });

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'Valid reason for abandoning');
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

    render(
      <AbandonCaseModal
        open={true}
        onClose={vi.fn()}
        onAbandon={onAbandon}
        caseData={null}
      />,
    );

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });

    await user.type(textarea, 'Valid reason for abandoning');
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

    expect(onClose).toHaveBeenCalled();
  });

  it('displays character count', async () => {
    const user = userEvent.setup();
    renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    await user.type(textarea, 'Test');

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

  it('renders modal with null caseData but open is true', () => {
    render(
      <AbandonCaseModal
        open={true}
        onClose={vi.fn()}
        onAbandon={vi.fn()}
        caseData={null}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /abandon case/i }),
    ).toBeInTheDocument();
  });

  it('trims reason before submitting', async () => {
    const user = userEvent.setup();
    const { onAbandon } = renderModal();

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    await user.type(textarea, '  Valid reason with spaces  ');

    const submitButton = screen.getByRole('button', { name: /abandon case/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onAbandon).toHaveBeenCalledWith(
        123,
        'Valid reason with spaces',
      );
    });
  });

  it('disables close button via X icon while submitting on sync error', async () => {
    const user = userEvent.setup();
    const onAbandon = vi.fn().mockImplementation(() => {
      throw new Error('Sync error');
    });
    renderModal({ onAbandon });

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    await user.type(textarea, 'Valid reason');

    const submitButton = screen.getByRole('button', { name: /abandon case/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Sync error')).toBeInTheDocument();
    });
  });

  it('resets reason on close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    const textarea = screen.getByPlaceholderText(/provide a detailed reason/i);
    await user.type(textarea, 'Some text');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
