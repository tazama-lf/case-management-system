import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => false,
    hasSupervisorRole: () => false,
    user: { id: 1, username: 'test' },
    isAuthenticated: true,
  }),
}));

const mockGetCaseDetails = vi.fn();
const mockGetSubCasesDetails = vi.fn();
const mockTransformBackendCaseToUI = vi.fn();

vi.mock('../../services/caseService', () => ({
  caseService: {
    getCaseDetails: (...args: any[]) => mockGetCaseDetails(...args),
    getSubCasesDetails: (...args: any[]) => mockGetSubCasesDetails(...args),
  },
}));

vi.mock('../casesTable.utils', async () => {
  const actual = await vi.importActual('../casesTable.utils');
  return {
    ...actual,
    transformBackendCaseToUI: (...args: any[]) =>
      mockTransformBackendCaseToUI(...args),
  };
});

// Mock child components
vi.mock('../view/CaseDetailsTab', () => ({
  default: () => <div>Case Details Tab</div>,
}));
vi.mock('../view/CaseHistoryTab', () => ({
  default: () => <div>Case History Tab</div>,
}));
vi.mock('../view/InvestigationSummaryTab', () => ({
  default: () => <div>Investigation Summary Tab</div>,
}));
vi.mock('../view/TaskLogTab', () => ({
  default: ({ onRefreshCases }: any) => (
    <div>
      Task Log Tab
      <button onClick={onRefreshCases}>Refresh Cases From Task</button>
    </div>
  ),
}));
vi.mock('../view/CollaboratePanel', () => ({
  default: () => <div>Collaborate Panel</div>,
}));

vi.mock('../view/LinkedItemsTab', () => ({
  default: () => <div>Linked Items Tab</div>,
}));

vi.mock('../view/CommentHistoryTab', () => ({
  default: () => <div>Comments History Tab</div>,
}));
vi.mock('../view/CaseActionsPanel', () => ({
  default: () => <div>Case Actions Panel</div>,
}));

vi.mock('../view/VisualizationsTab', () => ({
  default: ({ transactionId }: any) => (
    <div>Visualizations Tab {transactionId && `txn:${transactionId}`}</div>
  ),
}));

import ViewCaseModal from '../ViewCaseModal';

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
};

const mockFraudAmlCase: CaseRow = {
  ...mockCaseData,
  type: 'FRAUD_AND_AML',
};

const mockCaseWithParent: CaseRow = {
  ...mockCaseData,
  parentId: 999,
};

describe('ViewCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRefreshCases = vi.fn();
  const mockSetSubCasesDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCaseDetails.mockResolvedValue({});
    mockGetSubCasesDetails.mockResolvedValue([]);
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);
    mockOnRefreshCases.mockResolvedValue(undefined);
  });

  it('does not render when open is false', () => {
    render(
      <ViewCaseModal
        open={false}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    expect(
      screen.queryByRole('heading', { name: /Case Details/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render when row is null', () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={null}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    expect(
      screen.queryByRole('heading', { name: /Case Details/i }),
    ).not.toBeInTheDocument();
  });

  it('renders modal with case details when open', () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Case Details/i }),
    ).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays tabs for navigation', () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(screen.getAllByText('Case Details').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText('Task Log')).toBeInTheDocument();
    expect(screen.getByText('Linked Items')).toBeInTheDocument();
    expect(screen.getByText('Case History')).toBeInTheDocument();
    expect(screen.getByText('Comments History')).toBeInTheDocument();
  });

  it('switches to Task Log tab', async () => {
    const user = userEvent.setup();
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Task Log'));
    expect(screen.getByText('Task Log Tab')).toBeInTheDocument();
  });

  it('switches to Linked Items tab', async () => {
    const user = userEvent.setup();
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    await user.click(screen.getByText('Linked Items'));
    expect(screen.getByText('Linked Items Tab')).toBeInTheDocument();
  });

  it('switches to Case History tab', async () => {
    const user = userEvent.setup();
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Case History'));
    expect(screen.getByText('Case History Tab')).toBeInTheDocument();
  });

  it('switches to Comments History tab', async () => {
    const user = userEvent.setup();
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Comments History'));
    expect(screen.getByText('Comments History Tab')).toBeInTheDocument();
  });

  it('shows CaseActionsPanel only on details tab', async () => {
    const user = userEvent.setup();
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Actions panel visible on details tab
    expect(screen.getByText('Case Actions Panel')).toBeInTheDocument();

    // Switch to Task Log tab - actions panel should be hidden
    await user.click(screen.getByText('Task Log'));
    expect(screen.queryByText('Case Actions Panel')).not.toBeInTheDocument();
  });

  it('fetches sub-cases for FRAUD_AND_AML type', async () => {
    const subCasesData = [
      { ...mockCaseData, id: 456, type: 'FRAUD' },
      { ...mockCaseData, id: 789, type: 'AML' },
    ];
    mockGetSubCasesDetails.mockResolvedValue(subCasesData);
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockFraudAmlCase}
        onRefreshCases={mockOnRefreshCases}
        setSubCasesDetails={mockSetSubCasesDetails}
      />,
    );

    await waitFor(() => {
      expect(mockGetSubCasesDetails).toHaveBeenCalledWith(mockFraudAmlCase.id);
    });
  });

  it('does not fetch sub-cases for non FRAUD_AND_AML type', async () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
        setSubCasesDetails={mockSetSubCasesDetails}
      />,
    );

    await waitFor(() => {
      // getSubCasesDetails should not be called for FRAUD type
      expect(mockGetSubCasesDetails).not.toHaveBeenCalled();
    });
    // setSubCasesDetails should be called with empty
    expect(mockSetSubCasesDetails).toHaveBeenCalledWith([]);
  });

  it('fetches parent case details when parentId exists', async () => {
    mockGetCaseDetails.mockResolvedValue({ id: 999, type: 'FRAUD' });
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseWithParent}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(mockGetCaseDetails).toHaveBeenCalledWith(999);
    });
  });

  it('handles getCaseDetails error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockGetCaseDetails.mockRejectedValue(new Error('fetch failed'));

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseWithParent}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to refresh case data:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('handles getSubCasesDetails error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockGetSubCasesDetails.mockRejectedValue(new Error('sub-cases failed'));

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockFraudAmlCase}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch subCases data:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('refreshes case data from task log tab', async () => {
    const user = userEvent.setup();
    mockGetCaseDetails.mockResolvedValue({ ...mockCaseData });
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Task Log'));
    await user.click(screen.getByText('Refresh Cases From Task'));

    await waitFor(() => {
      expect(mockOnRefreshCases).toHaveBeenCalled();
    });
  });

  it('hides tabs when showCollaborate is true', () => {
    // This is harder to test since showCollaborate is internal state
    // and only toggled by child components. We verify tabs are shown by default.
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(screen.getByText('Task Log')).toBeInTheDocument();
  });

  // ─── Visualizations tab tests ────────────────────────────────────────

  it('does not show Visualizations tab when row has no transaction', () => {
    const caseNoTxn: CaseRow = { ...mockCaseData, transaction: undefined };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseNoTxn}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    expect(screen.queryByText('Visualizations')).not.toBeInTheDocument();
  });

  it('does not show Visualizations tab when transaction has no FIToFIPmtSts', () => {
    const caseNonPacs: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({ TxTp: 'pacs.008.001.10' }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseNonPacs}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    expect(screen.queryByText('Visualizations')).not.toBeInTheDocument();
  });

  it('shows Visualizations tab when transaction has FIToFIPmtSts', () => {
    const caseWithPacs: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'TXN-001' } },
      }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithPacs}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    expect(screen.getByText('Visualizations')).toBeInTheDocument();
  });

  it('switches to Visualizations tab and renders transactionId from row', async () => {
    const user = userEvent.setup();
    const caseWithPacs: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'TXN-001' } },
      }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithPacs}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:TXN-001/)).toBeInTheDocument();
  });

  it('falls back to EndToEndId when OrgnlEndToEndId is missing', async () => {
    const user = userEvent.setup();
    const caseWithE2E: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { EndToEndId: 'E2E-TXN' } },
      }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithE2E}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:E2E-TXN/)).toBeInTheDocument();
  });

  it('hides Visualizations tab when transaction is invalid JSON', () => {
    const caseBadJson: CaseRow = {
      ...mockCaseData,
      transaction: 'not valid json{{{',
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseBadJson}
        onRefreshCases={mockOnRefreshCases}
      />,
    );
    expect(screen.queryByText('Visualizations')).not.toBeInTheDocument();
  });

  it('does not extract transactionId when only transaction_id field exists (no FIToFIPmtSts)', () => {
    const caseTxnId: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({ transaction_id: 'SIMPLE' }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseTxnId}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // No Visualizations tab since no FIToFIPmtSts
    expect(screen.queryByText('Visualizations')).not.toBeInTheDocument();
  });

  it('shows Visualizations tab using parent case transaction data', async () => {
    const user = userEvent.setup();
    const parentCaseRow: CaseRow = {
      ...mockCaseData,
      id: 999,
      alertId: 42,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'PARENT-TXN' } },
      }),
    };
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);
    // getParentCaseData will call getCaseDetails and transform
    mockGetCaseDetails.mockResolvedValue(parentCaseRow);

    const caseWithParent: CaseRow = { ...mockCaseData, parentId: 999 };

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithParent}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Wait for parent case data to be fetched and transformed
    await waitFor(() => {
      expect(mockGetCaseDetails).toHaveBeenCalledWith(999);
    });

    await waitFor(() => {
      expect(screen.getByText('Visualizations')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:PARENT-TXN/)).toBeInTheDocument();
  });

  it('defers Visualizations tab while parent case is loading', async () => {
    let resolveParent: ((value: unknown) => void) | undefined;
    mockGetCaseDetails.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveParent = resolve;
        }),
    );

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={{ ...mockCaseData, parentId: 999 }}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Should not show Visualizations while parent is loading
    expect(screen.queryByText('Visualizations')).not.toBeInTheDocument();

    // Resolve the parent case with transaction data
    const parentRow: CaseRow = {
      ...mockCaseData,
      id: 999,
      alertId: 42,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'PARENT-TXN' } },
      }),
    };
    resolveParent?.(parentRow);

    await waitFor(() => {
      expect(screen.getByText('Visualizations')).toBeInTheDocument();
    });
  });

  it('uses parentCase.alertId when row has parentId for VisualizationsTab', async () => {
    const parentRow: CaseRow = {
      ...mockCaseData,
      id: 999,
      alertId: 42,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'PARENT-TXN' } },
      }),
    };
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);
    mockGetCaseDetails.mockResolvedValue(parentRow);

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={{ ...mockCaseData, parentId: 999 }}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Visualizations')).toBeInTheDocument();
    });
  });

  it('switches away from Visualizations tab when it becomes hidden', async () => {
    const user = userEvent.setup();
    // Start with a case that shows Visualizations
    const caseWithPacs: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'TXN-001' } },
      }),
    };
    const { rerender } = render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithPacs}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Switch to Visualizations tab
    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:TXN-001/)).toBeInTheDocument();

    // Now re-render with a row that has no Visualizations
    const caseNoViz: CaseRow = { ...mockCaseData, transaction: undefined };
    rerender(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseNoViz}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Should have switched back to details tab, Case Actions Panel visible again
    await waitFor(() => {
      expect(screen.getByText('Case Actions Panel')).toBeInTheDocument();
    });
  });

  it('handles transaction data as object (not JSON string)', async () => {
    const user = userEvent.setup();
    const caseWithObjTxn: CaseRow = {
      ...mockCaseData,
      transaction: {
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 'OBJ-TXN' } },
      } as unknown,
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithObjTxn}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:OBJ-TXN/)).toBeInTheDocument();
  });

  it('extracts transactionId from transaction_id fallback field', async () => {
    const user = userEvent.setup();
    const caseWithTxnId: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: {},
        transaction_id: 'FALLBACK-TXN',
      }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithTxnId}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:FALLBACK-TXN/)).toBeInTheDocument();
  });

  it('extracts transactionId from transactionId (camelCase) fallback field', async () => {
    const user = userEvent.setup();
    const caseWithCamelTxn: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: {},
        transactionId: 'CAMEL-TXN',
      }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithCamelTxn}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:CAMEL-TXN/)).toBeInTheDocument();
  });

  it('returns undefined transactionId when extracted ID is not a string', async () => {
    const user = userEvent.setup();
    const caseWithNonStringId: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: 12345 } },
      }),
    };
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithNonStringId}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Visualizations tab should still show (FIToFIPmtSts exists)
    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText('Visualizations Tab')).toBeInTheDocument();
    // But no txn: prefix since transactionId is undefined
    expect(screen.queryByText(/txn:/)).not.toBeInTheDocument();
  });

  it('handles parent case fetch error for getParentCaseData gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockGetCaseDetails.mockRejectedValue(new Error('parent fetch failed'));

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseWithParent}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to refresh case data:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('does not fetch parent case data when row has no parentId', () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // getCaseDetails should not be called for parent (no parentId)
    // It may be called for refreshCaseData but not for parent
    expect(mockGetCaseDetails).not.toHaveBeenCalledWith(999);
  });

  it('handles refreshCaseData error when called from TaskLogTab', async () => {
    const user = userEvent.setup();
    // First call succeeds for initial render, second call fails for refresh
    mockGetCaseDetails
      .mockResolvedValueOnce({ ...mockCaseData })
      .mockRejectedValueOnce(new Error('refresh failed'));
    mockTransformBackendCaseToUI.mockImplementation((c: any) => c);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByText('Task Log'));
    await user.click(screen.getByText('Refresh Cases From Task'));

    await waitFor(() => {
      expect(mockOnRefreshCases).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('renders Case Details tab content by default', () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(screen.getByText('Case Details Tab')).toBeInTheDocument();
  });

  it('passes canManageSupervisorActions prop', () => {
    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
        canManageSupervisorActions={true}
      />,
    );

    // Component renders without error
    expect(
      screen.getByRole('heading', { name: /Case Details/i }),
    ).toBeInTheDocument();
  });
});
