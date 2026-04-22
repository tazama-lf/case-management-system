import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloseCaseModal from '../CloseCaseModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { CaseRow } from '../casesTable.utils';

let mockIsSupervisor = false;
vi.mock('@/features/auth', () => ({
  authService: {
    getUser: vi.fn(() =>
      mockIsSupervisor ? { validatedClaims: { CMS_SUPERVISOR: true } } : null,
    ),
  },
}));

vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: vi.fn((status: string) => status),
}));

vi.mock('../../components/modals/GenerateInvestigationReportModal', () => ({
  default: ({ open, onApproved }: { open: boolean; onApproved: () => void }) =>
    open ? (
      <div data-testid="report-modal">
        <button onClick={onApproved}>Approve Report</button>
      </div>
    ) : null,
}));

const mockCaseData: CaseRow = {
  id: 123,
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
  alertId: 1,
  tasks: [],
};

const mockFraudAmlCaseData: CaseRow = {
  ...mockCaseData,
  type: 'FRAUD_AND_AML',
};

const mockSubCases: CaseRow[] = [
  {
    ...mockCaseData,
    id: 456,
    type: 'FRAUD',
    status: 'STATUS_82_CLOSED_CONFIRMED',
  },
  {
    ...mockCaseData,
    id: 789,
    type: 'AML',
    status: 'STATUS_81_CLOSED_REFUTED',
  },
];

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupervisor = false;
    mockOnSubmit.mockResolvedValue(undefined);
  });

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

  it('shows supervisor message when user is supervisor', () => {
    mockIsSupervisor = true;
    render(<CloseCaseModal {...defaultProps} />);
    expect(
      screen.getByText(/As a supervisor, you can directly close this case/i),
    ).toBeInTheDocument();
  });

  it('shows investigator message when user is not supervisor', () => {
    render(<CloseCaseModal {...defaultProps} />);
    expect(
      screen.getByText(/This will submit the case for supervisor approval/i),
    ).toBeInTheDocument();
  });

  it('shows Submit for Approval for investigator', () => {
    render(<CloseCaseModal {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /Submit for Approval/i }),
    ).toBeInTheDocument();
  });

  it('shows Generate Investigation Report for supervisor (non FRAUD_AND_AML)', () => {
    mockIsSupervisor = true;
    render(<CloseCaseModal {...defaultProps} caseData={mockCaseData} />);
    expect(
      screen.getByRole('button', { name: /Generate Investigation Report/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Submit for Approval/i }),
    ).not.toBeInTheDocument();
  });

  it('disables Generate Report button when notes are too short', () => {
    mockIsSupervisor = true;
    render(<CloseCaseModal {...defaultProps} caseData={mockCaseData} />);
    const genBtn = screen.getByRole('button', {
      name: /Generate Investigation Report/i,
    });
    expect(genBtn).toBeDisabled();
  });

  it('opens report modal when Generate Report clicked with valid notes', async () => {
    mockIsSupervisor = true;
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} caseData={mockCaseData} />);
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid notes here');
    const genBtn = screen.getByRole('button', {
      name: /Generate Investigation Report/i,
    });
    await user.click(genBtn);
    expect(screen.getByTestId('report-modal')).toBeInTheDocument();
  });

  it('calls closeCase when report is approved', async () => {
    mockIsSupervisor = true;
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} caseData={mockCaseData} />);
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid notes here');
    const genBtn = screen.getByRole('button', {
      name: /Generate Investigation Report/i,
    });
    await user.click(genBtn);
    await user.click(screen.getByText('Approve Report'));
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('shows FRAUD_AND_AML sub-cases when provided', () => {
    render(
      <CloseCaseModal
        {...defaultProps}
        caseData={mockFraudAmlCaseData}
        subCasesDetails={mockSubCases}
      />,
    );
    expect(screen.getByText('Sub-Cases Closure Status')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
    expect(screen.getByText('789')).toBeInTheDocument();
  });

  it('shows COMPLETED outcome for FRAUD_AND_AML case', () => {
    render(
      <CloseCaseModal
        {...defaultProps}
        caseData={mockFraudAmlCaseData}
        subCasesDetails={mockSubCases}
      />,
    );
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Final Outcome')).toBeInTheDocument();
  });

  it('shows Close Case button for supervisor with FRAUD_AND_AML', () => {
    mockIsSupervisor = true;
    render(
      <CloseCaseModal
        {...defaultProps}
        caseData={mockFraudAmlCaseData}
        subCasesDetails={mockSubCases}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Close Case/i }),
    ).toBeInTheDocument();
  });

  it('submits FRAUD_AND_AML supervisor close case', async () => {
    mockIsSupervisor = true;
    const user = userEvent.setup();
    render(
      <CloseCaseModal
        {...defaultProps}
        caseData={mockFraudAmlCaseData}
        subCasesDetails={mockSubCases}
      />,
    );
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Closing fraud and AML case');
    const closeBtn = screen.getByRole('button', { name: /Close Case/i });
    await user.click(closeBtn);
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('allows changing recommended outcome', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);
    const select = screen.getByDisplayValue('83 - Closed Inconclusive');
    await user.selectOptions(select, 'STATUS_81_CLOSED_REFUTED');
    expect(
      (screen.getByDisplayValue('81 - Closed Refuted') as HTMLSelectElement)
        .value,
    ).toBe('STATUS_81_CLOSED_REFUTED');
  });

  it('validates short notes (less than 4 chars)', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'abc');
    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    await user.click(submitBtn);
    expect(
      await screen.findByText('Final notes must be at least 4 characters'),
    ).toBeInTheDocument();
  });

  it('does not close modal while submitting', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    mockOnSubmit.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<CloseCaseModal {...defaultProps} />);
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid notes here');
    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    await user.click(submitBtn);
    // Try to close while submitting
    const closeBtn = screen.getByRole('button', { name: '' }); // XMarkIcon button
    await user.click(closeBtn);
    // onClose should not have been called because the close button is disabled
    expect(screen.getByText('Submitting for Approval...')).toBeInTheDocument();
    resolveSubmit!();
  });

  it('handles non-Error submission failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValueOnce('string error');
    render(<CloseCaseModal {...defaultProps} />);
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid notes here');
    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    await user.click(submitBtn);
    expect(
      await screen.findByText('Failed to close case. Please try again.'),
    ).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('resets form data on successful submission', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);
    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid notes here');
    const submitBtn = screen.getByRole('button', {
      name: /submit for approval/i,
    });
    await user.click(submitBtn);
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows caseName when provided', () => {
    render(<CloseCaseModal {...defaultProps} caseName="Test Case" />);
    expect(screen.getByText(/Test Case/)).toBeInTheDocument();
  });

  it('handles cancel button click', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);
    await user.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
