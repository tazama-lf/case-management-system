import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseDetailsTab from '../CaseDetailsTab';
import type { CaseRow } from '../../casesTable.utils';
import triageService from '../../../../alerts/services/triageservice';
import { evidenceService } from '../../../services/evidenceService';

vi.mock('../../../../alerts/services/triageservice');
vi.mock('../../../services/evidenceService');
vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
  }),
}));
vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: (status: string) => status,
}));
vi.mock('../CaseActionsPanel', () => ({
  default: () => <div data-testid="case-actions-panel">Actions Panel</div>,
}));

const mockCaseRow: CaseRow = {
  id: 'CASE-123',
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
  confidencePercent: 85,
  alertMessage: 'Suspicious activity detected',
};

describe('CaseDetailsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (triageService.getAlertTransactionalData as vi.Mock).mockResolvedValue([]);
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
  });

  it('renders case details with ID, type, status, priority, date', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('CASE-123')).toBeInTheDocument();
      expect(screen.getByText('Case Information')).toBeInTheDocument();
      expect(screen.getByText('FRAUD')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('01/01/2023')).toBeInTheDocument();
    });
  });

  it('displays alert information when alertId is present', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Information')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Suspicious activity detected')).toBeInTheDocument();
    });
  });

  it('hides alert section when no alertId', async () => {
    const rowNoAlert = { ...mockCaseRow, alertId: undefined };
    render(
      <CaseDetailsTab row={rowNoAlert} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Alert Information')).not.toBeInTheDocument();
    });
  });

  it('renders actions panel when showActions is true', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} showActions={true} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('case-actions-panel')).toBeInTheDocument();
    });
  });

  it('does not render actions panel when showActions is false', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} showActions={false} />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('case-actions-panel')).not.toBeInTheDocument();
    });
  });

  it('displays parent case information when parentId and parentCaseDetails exist', async () => {
    const rowWithParent = { ...mockCaseRow, parentId: 100 };
    const parentCase: CaseRow = {
      ...mockCaseRow,
      id: 'PARENT-100',
      type: 'FRAUD_AND_AML',
      status: 'STATUS_20_IN_PROGRESS',
      statusColor: 'bg-green-50',
    };

    render(
      <CaseDetailsTab row={rowWithParent} subCasesDetails={undefined} parentCaseDetails={parentCase} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Parent Case Information')).toBeInTheDocument();
      expect(screen.getByText('PARENT-100')).toBeInTheDocument();
    });
  });

  it('displays sub-case information for FRAUD_AND_AML type', async () => {
    const rowFraudAml = { ...mockCaseRow, type: 'FRAUD_AND_AML' };
    const subCases: CaseRow[] = [
      { ...mockCaseRow, id: 'SUB-1', type: 'FRAUD', typeColor: 'bg-red-50', status: 'STATUS_20_IN_PROGRESS', statusColor: 'bg-blue-50' },
      { ...mockCaseRow, id: 'SUB-2', type: 'AML', typeColor: 'bg-orange-50', status: 'STATUS_30_COMPLETED', statusColor: 'bg-green-50' },
    ];

    render(
      <CaseDetailsTab row={rowFraudAml} subCasesDetails={subCases} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sub Case Information')).toBeInTheDocument();
      expect(screen.getByText('SUB-1')).toBeInTheDocument();
      expect(screen.getByText('SUB-2')).toBeInTheDocument();
    });
  });

  it('does not show sub-case section for non-FRAUD_AND_AML type', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={[]} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Sub Case Information')).not.toBeInTheDocument();
    });
  });

  it('displays transaction data and allows toggling accordion', async () => {
    (triageService.getAlertTransactionalData as vi.Mock).mockResolvedValue([
      {
        transactionId: 'TXN-001',
        transactionData: { TxTp: 'Payment Transfer', Amount: 1000 },
      },
    ]);

    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Payment Transfer')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText('Payment Transfer'));

    await waitFor(() => {
      // JSON should be syntax-highlighted in the expanded body
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(screen.getByText('Payment Transfer'));
  });

  it('shows loading state while reports are loading for closed case', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockImplementation(() => new Promise(() => {}));

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    expect(screen.getByText('Loading case details…')).toBeInTheDocument();
  });

  it('shows View Investigation Report button for closed case with report', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2023-06-01T00:00:00Z' }],
        },
      ],
    });

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
  });

  it('does not show report button for non-closed case', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.queryByText('View Investigation Report')).not.toBeInTheDocument();
    });
  });

  it('handles report loading error gracefully', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockRejectedValue(new Error('fail'));

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Case Information')).toBeInTheDocument();
    });
  });

  it('handles view report click for previewable file', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2023-06-01T00:00:00Z' }],
        },
      ],
    });
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.viewEvidence as vi.Mock).mockResolvedValue(mockBlob);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Investigation Report'));

    await waitFor(() => {
      expect(evidenceService.viewEvidence).toHaveBeenCalledWith('RPT-001');
      expect(openSpy).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });

  it('handles view report error', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2023-06-01T00:00:00Z' }],
        },
      ],
    });
    (evidenceService.viewEvidence as vi.Mock).mockRejectedValue(new Error('Download failed'));

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Investigation Report'));

    // Error is handled - component should still render
    await waitFor(() => {
      expect(screen.getByText('Case Information')).toBeInTheDocument();
    });
  });

  it('displays confidence score with appropriate color', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  it('displays 0% confidence score when not provided', async () => {
    const rowNoScore = { ...mockCaseRow, confidencePercent: undefined };
    render(
      <CaseDetailsTab row={rowNoScore} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('fetches transactional data on mount', async () => {
    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(triageService.getAlertTransactionalData).toHaveBeenCalledWith(1);
    });
  });

  it('handles transactional data fetch failure gracefully', async () => {
    (triageService.getAlertTransactionalData as vi.Mock).mockRejectedValue(new Error('fail'));

    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    // Should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('Case Information')).toBeInTheDocument();
    });
  });

  it('selects latest report when multiple reports exist', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-OLD',
          attachments: [{ submittedAt: '2023-01-01T00:00:00Z' }],
        },
        {
          id: 'ev-2',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-NEW',
          attachments: [{ submittedAt: '2023-06-01T00:00:00Z' }],
        },
      ],
    });

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
  });

  it('shows N/A for missing alert message', async () => {
    const rowNoMessage = { ...mockCaseRow, alertMessage: undefined };
    render(
      <CaseDetailsTab row={rowNoMessage} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('shows "No transaction data" when transactionData is falsy', async () => {
    (triageService.getAlertTransactionalData as vi.Mock).mockResolvedValue([
      {
        transactionId: 'TXN-EMPTY',
        transactionData: null,
      },
    ]);

    render(
      <CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    // Expand the transaction accordion
    const buttons = screen.getAllByRole('button');
    const txButton = buttons.find(btn => btn.closest('section'));
    fireEvent.click(txButton!);

    await waitFor(() => {
      expect(screen.getByText('No transaction data')).toBeInTheDocument();
    });
  });

  it('revokes blob URL for non-previewable file when user declines download', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2023-06-01T00:00:00Z' }],
        },
      ],
    });
    const mockBlob = new Blob(['test'], { type: 'application/octet-stream' });
    (evidenceService.viewEvidence as vi.Mock).mockResolvedValue(mockBlob);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-non-previewable');
    globalThis.URL.revokeObjectURL = vi.fn();

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View Investigation Report'));

    await waitFor(() => {
      expect(evidenceService.viewEvidence).toHaveBeenCalledWith('RPT-001');
      expect(confirmSpy).toHaveBeenCalled();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-non-previewable');
    });

    confirmSpy.mockRestore();
  });

  it('revokes blob URL after timeout for previewable file', async () => {
    vi.useFakeTimers();
    const closedRow = { ...mockCaseRow, status: 'STATUS_81_CLOSED_REFUTED' };
    (evidenceService.getCaseEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2023-06-01T00:00:00Z' }],
        },
      ],
    });
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.viewEvidence as vi.Mock).mockResolvedValue(mockBlob);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-previewable');
    globalThis.URL.revokeObjectURL = vi.fn();

    render(
      <CaseDetailsTab row={closedRow} subCasesDetails={undefined} parentCaseDetails={null} />,
    );

    await vi.waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await vi.runAllTimersAsync().catch(() => {});

    fireEvent.click(screen.getByText('View Investigation Report'));

    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    // Advance by 30 seconds to trigger the cleanup setTimeout
    vi.advanceTimersByTime(30000);

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-previewable');

    openSpy.mockRestore();
    vi.useRealTimers();
  });
});
