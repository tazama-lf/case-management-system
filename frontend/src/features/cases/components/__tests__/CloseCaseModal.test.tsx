import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloseCaseModal from '../CloseCaseModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { authService } from '@/features/auth';
import type { CaseRow } from '../casesTable.utils';

vi.mock('../modals/GenerateInvestigationReportModal', () => ({
  default: ({ onApproved }: any) => (
    <div data-testid="generate-report-modal">
      <button onClick={onApproved}>Approve Report</button>
    </div>
  ),
}));

vi.mock('@/features/auth', () => ({
  authService: {
    getUser: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: (s: string) => s,
}));

const mockRow: CaseRow = {
  id: 123,
  alertId: 456,
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_20_IN_PROGRESS',
  statusColor: 'bg-yellow-50',
  score: 85,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  priority: 'HIGH',
  assignee: 'John Doe',
  userRole: 'owner',
  totalTasks: 1,
};

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
    vi.mocked(authService.getUser).mockReturnValue(null);
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

  it('validates minimum note length', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText(/provide detailed notes/i), 'ab');
    await user.click(screen.getByRole('button', { name: /submit for approval/i }));

    expect(await screen.findByText('Final notes must be at least 4 characters')).toBeInTheDocument();
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

  it('closes modal when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('changes recommended outcome when select changes', async () => {
    const user = userEvent.setup();
    render(<CloseCaseModal {...defaultProps} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'STATUS_81_CLOSED_REFUTED');

    const notesInput = screen.getByPlaceholderText(/provide detailed notes/i);
    await user.type(notesInput, 'Valid investigation notes');

    await user.click(screen.getByRole('button', { name: /submit for approval/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ recommendedOutcome: 'STATUS_81_CLOSED_REFUTED' }),
    );
  });

  it('shows supervisor message when user is supervisor', () => {
    vi.mocked(authService.getUser).mockReturnValue({
      validatedClaims: { CMS_SUPERVISOR: true },
    } as any);

    render(<CloseCaseModal {...defaultProps} />);

    expect(screen.getByText('As a supervisor, you can directly close this case.')).toBeInTheDocument();
  });

  it('renders FRAUD_AND_AML auto-generated outcome message', () => {
    const fraudAmlRow: CaseRow = { ...mockRow, type: 'FRAUD_AND_AML' };

    render(<CloseCaseModal {...defaultProps} caseData={fraudAmlRow} />);

    expect(screen.getByText('Outcome is auto-generated from Fraud & AML sub-case closures.')).toBeInTheDocument();
  });

  it('renders sub-cases when caseData is FRAUD_AND_AML with subCasesDetails', () => {
    const fraudAmlRow: CaseRow = { ...mockRow, type: 'FRAUD_AND_AML' };
    const subCase: CaseRow = { ...mockRow, id: 999, type: 'FRAUD' };

    render(
      <CloseCaseModal
        {...defaultProps}
        caseData={fraudAmlRow}
        subCasesDetails={[subCase]}
      />,
    );

    expect(screen.getByText('Sub-Cases Closure Status')).toBeInTheDocument();
  });

  it('shows supervisor report button when supervisor and no report yet', () => {
    vi.mocked(authService.getUser).mockReturnValue({
      validatedClaims: { CMS_SUPERVISOR: true },
    } as any);

    render(<CloseCaseModal {...defaultProps} caseData={mockRow} />);

    // After typing enough notes, the Generate Report button should appear
    expect(screen.getByText('Generate Investigation Report')).toBeInTheDocument();
  });

  it('shows supervisor Close Case button when supervisor + FRAUD_AND_AML', () => {
    vi.mocked(authService.getUser).mockReturnValue({
      validatedClaims: { CMS_SUPERVISOR: true },
    } as any);

    const fraudAmlRow: CaseRow = { ...mockRow, type: 'FRAUD_AND_AML' };

    render(<CloseCaseModal {...defaultProps} caseData={fraudAmlRow} />);

    expect(screen.getByRole('button', { name: /Close Case/i })).toBeInTheDocument();
  });

  it('triggers closeCase when onApproved is called in GenerateInvestigationReportModal', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.getUser).mockReturnValue({
      validatedClaims: { CMS_SUPERVISOR: true },
    } as any);
    mockOnSubmit.mockResolvedValue(undefined);

    render(<CloseCaseModal {...defaultProps} caseData={mockRow} />);

    // Type notes so validateForm passes
    await user.type(
      screen.getByPlaceholderText(/provide detailed notes/i),
      'Valid investigation notes for final report.',
    );

    // Click Approve Report in the mocked modal
    const approveBtn = screen.getByRole('button', { name: /Approve Report/i });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});
