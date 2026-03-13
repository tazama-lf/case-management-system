import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApproveCaseCreationModal from '../ApproveCaseCreationModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

const mockGetAlertById = vi.fn().mockResolvedValue(null);
vi.mock('@/features/alerts/services/triageservice', () => ({
  default: {
    getAlertById: (...args: unknown[]) => mockGetAlertById(...args),
  },
}));

vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: (status: string) => {
    const map: Record<string, string> = {
      STATUS_01_PENDING_CASE_CREATION_APPROVAL:
        '01_PENDING_CASE_CREATION_APPROVAL',
      STATUS_00_DRAFT: '00_DRAFT',
    };
    return map[status] ?? status;
  },
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d,
}));

const mockCaseRow: CaseRow = {
  id: 123,
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
  statusColor: 'bg-blue-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '-',
  action: 'View',
  assignee: 'Unassigned',
  priority: 'HIGH',
  userRole: 'none',
  totalTasks: 0,
  alertId: 0,
};

const mockCaseRowWithAlert: CaseRow = {
  ...mockCaseRow,
  alertId: 456,
};

/** Helper: the submit button is outside the <form>, so we submit via form */
function submitForm() {
  const form = document.querySelector('form');
  if (form) fireEvent.submit(form);
}

describe('ApproveCaseCreationModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAlertById.mockResolvedValue(null);
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <ApproveCaseCreationModal
        open={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not render when caseData is null', () => {
    const { container } = render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the case details and exposes actionable buttons', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /approve case creation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/case id:/i)).toHaveTextContent('123');
    expect(
      screen.getByRole('button', { name: /approve case creation/i }),
    ).toBeEnabled();
  });

  it('displays case details correctly', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    expect(screen.getByText('FRAUD')).toBeInTheDocument();
    expect(
      screen.getByText('01_PENDING_CASE_CREATION_APPROVAL'),
    ).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('01/01/2023')).toBeInTheDocument();
  });

  it('displays associated alert section when alertId is present', async () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/associated alert/i)).toBeInTheDocument();
      expect(screen.getByText('456')).toBeInTheDocument();
    });
  });

  it('does not display alert section when alertId is falsy', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    expect(screen.queryByText(/associated alert/i)).not.toBeInTheDocument();
  });

  it('submits form successfully', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(123);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles submit error and displays error message', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to approve'));

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      expect(screen.getByText('Failed to approve')).toBeInTheDocument();
    });
  });

  it('handles submit error with non-Error object', async () => {
    const onSubmit = vi.fn().mockRejectedValue('String error');

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText(
          /Failed to approve case creation. Please try again./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it('does not submit when caseData is null', () => {
    const onSubmit = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        caseData={null}
      />,
    );

    // Modal should not render when caseData is null
    expect(
      screen.queryByRole('button', { name: /approve case creation/i }),
    ).not.toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state while submitting', async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(() => new Promise(() => {}));
    const onClose = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      expect(screen.getByText('Approving...')).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('resets errors when closing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to approve'));
    const onClose = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      expect(screen.getByText('Failed to approve')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('displays green info text about approving creation request', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    expect(
      screen.getByText(/approve the manual case creation request/i),
    ).toBeInTheDocument();
  });

  it('shows Case Details heading', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    expect(screen.getByText('Case Details')).toBeInTheDocument();
  });

  it('disables cancel button while submitting', async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(() => new Promise(() => {}));

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  // --- Coverage boost: alert details display paths ---

  it('displays full alert details when getAlertById returns data', async () => {
    mockGetAlertById.mockResolvedValue({
      alert_id: 456,
      tenant_id: 'T1',
      priority: 'HIGH',
      alert_type: 'FRAUD',
      source: 'TMS',
      txtp: 'TRANSFER',
      message: 'Suspicious transfer detected',
      transaction: { amount: 5000, currency: 'USD' },
      network_map: null,
      confidence_per: 85.5,
      created_at: '2024-01-15T10:30:00Z',
      prediction_outcome: 'TRUE_POSITIVE',
    });

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('85.50%')).toBeInTheDocument();
    });

    // alert_type 'FRAUD' also matches case type, so check the label + content
    expect(screen.getByText('Alert Type')).toBeInTheDocument();
    expect(screen.getByText('TMS')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15T10:30:00Z')).toBeInTheDocument();
    expect(screen.getByText('TRUE_POSITIVE')).toBeInTheDocument();
    expect(screen.getByText('TRANSFER')).toBeInTheDocument();
    expect(screen.getByText('Suspicious transfer detected')).toBeInTheDocument();
    // Transaction data rendered as JSON
    expect(screen.getByText(/5000/)).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it('displays alert details without optional fields', async () => {
    mockGetAlertById.mockResolvedValue({
      alert_id: 456,
      tenant_id: 'T1',
      priority: 'MEDIUM',
      alert_type: null,
      source: null,
      message: '',
      transaction: null,
      network_map: null,
      confidence_per: 42.1,
      created_at: '2024-06-01T00:00:00Z',
    });

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('42.10%')).toBeInTheDocument();
    });

    // N/A fallbacks for null alert_type and source
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(2);
    // No prediction_outcome, txtp, message, or transaction data sections
    expect(screen.queryByText('Prediction Outcome')).not.toBeInTheDocument();
    expect(screen.queryByText('Transaction Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Alert Message')).not.toBeInTheDocument();
    expect(screen.queryByText('Transaction Data')).not.toBeInTheDocument();
  });

  it('shows loading spinner while alert is being fetched', async () => {
    // Never resolve to keep loading state
    mockGetAlertById.mockImplementation(() => new Promise(() => {}));

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/loading alert details/i)).toBeInTheDocument();
    });
  });

  it('shows "Unable to load alert details" on fetch error', async () => {
    mockGetAlertById.mockRejectedValue(new Error('Network error'));

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load alert details/i),
      ).toBeInTheDocument();
    });
  });

  it('renders alert labels (Confidence Score, Alert Type, Source, etc.)', async () => {
    mockGetAlertById.mockResolvedValue({
      alert_id: 456,
      tenant_id: 'T1',
      priority: 'LOW',
      alert_type: 'AML',
      source: 'SWIFT',
      message: 'Alert msg',
      transaction: { id: 1 },
      network_map: null,
      confidence_per: 99,
      created_at: '2024-01-01',
      prediction_outcome: 'FALSE_POSITIVE',
      txtp: 'PAYMENT',
    });

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Confidence Score')).toBeInTheDocument();
    });

    expect(screen.getByText('Alert Type')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Created At')).toBeInTheDocument();
    expect(screen.getByText('Prediction Outcome')).toBeInTheDocument();
    expect(screen.getByText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByText('Alert Message')).toBeInTheDocument();
    expect(screen.getByText('Transaction Data')).toBeInTheDocument();
  });

  it('does not close modal while submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockImplementation(() => new Promise(() => {}));
    const onClose = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    submitForm();

    await waitFor(() => {
      expect(screen.getByText('Approving...')).toBeInTheDocument();
    });

    // Try to close via the X button
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[0]; // first button is X icon
    await user.click(closeButton);

    // onClose should NOT have been called because isSubmitting is true
    expect(onClose).not.toHaveBeenCalled();
  });
});
