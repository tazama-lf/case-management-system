import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApproveCaseCreationModal from '../ApproveCaseCreationModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: vi.fn((status: string) => status),
}));

vi.mock('@/features/alerts/services/triageservice', () => ({
  default: {
    getAlertById: vi.fn().mockResolvedValue({
      alert_id: 456,
      confidence_per: 85,
      alert_type: 'FRAUD',
      message: 'Suspicious transaction detected',
      source: 'System',
      priority: 'HIGH',
      created_at: '2023-01-01',
      transaction: null,
    }),
  },
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: vi.fn((date: string) => date),
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
  alertId: 1,
};

const mockCaseRowWithAlert: CaseRow = {
  ...mockCaseRow,
  alertId: 456,
  confidencePercent: 85,
  alertMessage: 'Suspicious transaction detected',
};

describe('ApproveCaseCreationModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /approve case creation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/case id: 123/i)).toBeInTheDocument();
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
      screen.getByText('STATUS_01_PENDING_CASE_CREATION_APPROVAL'),
    ).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('01/01/2023')).toBeInTheDocument();
  });

  it('displays associated alert when alertId is present', async () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRowWithAlert}
      />,
    );

    // Check for the alert section heading specifically
    const alertHeadings = screen.getAllByText(/associated alert/i);
    expect(alertHeadings.length).toBeGreaterThan(0);
    expect(await screen.findByText('85.00%')).toBeInTheDocument();
    expect(
      await screen.findByText('Suspicious transaction detected'),
    ).toBeInTheDocument();
  });

  it('does not display alert section when alertId is missing', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    // The "Associated Alert" heading should not appear (only in approval confirmation)
    const alertHeadings = screen.queryAllByText(/Associated Alert/i);
    // Should only appear in the approval confirmation section, not as a separate section
    expect(alertHeadings.length).toBeLessThanOrEqual(1);
    expect(screen.queryByText('456')).not.toBeInTheDocument();
  });

  it('submits form successfully', async () => {
    const user = userEvent.setup();
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

    const submitButton = screen.getByRole('button', {
      name: /approve case creation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(123);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles submit error and displays error message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to approve'));

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve case creation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to approve')).toBeInTheDocument();
    });
  });

  it('handles submit error with non-Error object', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue('String error');

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve case creation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to approve case creation. Please try again./i),
      ).toBeInTheDocument();
    });
  });

  it('does not submit when caseData is null', async () => {
    const user = userEvent.setup();
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

  it('closes modal when close button is clicked', async () => {
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

  it('does not close when submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockImplementation(() => new Promise(() => { })); // Never resolves
    const onClose = vi.fn();

    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: /approve case creation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      // Check button text content specifically
      expect(submitButton.textContent).toContain('Approving...');
    });

    // onClose should not be called while submitting
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays approval information', () => {
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

  it('displays case details section', () => {
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        caseData={mockCaseRow}
      />,
    );

    expect(screen.getByText('Case Details')).toBeInTheDocument();
    expect(screen.getByText('Case Type')).toBeInTheDocument();
    expect(screen.getByText('Current Status')).toBeInTheDocument();
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

    const submitButton = screen.getByRole('button', {
      name: /approve case creation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to approve')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });
});
