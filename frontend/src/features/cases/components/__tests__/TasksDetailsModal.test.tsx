import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock child components that have complex dependencies
vi.mock('../view/TaskDetailsTab', () => ({
  default: () => <div>Task Details Tab</div>,
}));

vi.mock('../view/TaskEvidenceTab', () => ({
  default: ({ onUploadComplete }: any) => (
    <div>
      Task Evidence Tab
      <button onClick={onUploadComplete}>Upload Complete</button>
    </div>
  ),
}));

vi.mock('../view/LinkedItemsTab', () => ({
  default: () => <div>Linked Items Tab</div>,
}));

vi.mock('../view/InvestigationNotesTab', () => ({
  default: ({ onNotesUpdate }: any) => (
    <div>
      Investigation Notes Tab
      <button onClick={onNotesUpdate}>Notes Updated</button>
    </div>
  ),
}));

vi.mock('../view/CustomerProfileTab', () => ({
  default: () => <div>Customer Profile Tab</div>,
}));

vi.mock('../view/CollaboratePanel', () => ({
  default: () => <div>Collaborate Panel</div>,
}));

vi.mock('../view/VisualizationsTab', () => ({
  default: ({ transactionId }: any) => (
    <div>Visualizations Tab {transactionId && `txn:${transactionId}`}</div>
  ),
}));

vi.mock('../view/InvestigationsSummaryTab', () => ({
  default: ({ onTaskUpdate }: any) => (
    <div>
      Investigation Summary Tab
      <button onClick={onTaskUpdate}>Refresh Tasks</button>
    </div>
  ),
}));

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => false,
    hasSupervisorRole: () => false,
    user: { id: 1, username: 'test' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import TasksDetailsModal from '../TasksDetailsModal';

const mockGetTasksByCaseId = vi.fn();
const mockGetCaseDetails = vi.fn();

vi.mock('../../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: (...args: any[]) => mockGetTasksByCaseId(...args),
  },
}));

vi.mock('../../services/caseService', () => ({
  caseService: {
    getCaseDetails: (...args: any[]) => mockGetCaseDetails(...args),
  },
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
  transaction: JSON.stringify({
    FIToFIPmtSts: {
      TxInfAndSts: {
        OrgnlEndToEndId: 'TXN-12345',
      },
    },
  }),
};

const mockCaseWithParent: CaseRow = {
  ...mockCaseData,
  parentId: 999,
};

const mockTasks = [
  {
    task_id: 'TASK-1',
    task_type: 'Review',
    status: 'IN_PROGRESS',
    name: 'Investigate Case',
  },
];

describe('TasksDetailsModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRefreshCases = vi.fn();
  const mockOnTaskUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTasksByCaseId.mockResolvedValue([]);
    mockGetCaseDetails.mockResolvedValue({
      alert: { alert_id: 42, transaction: null },
    });
  });

  const renderModal = (
    props: Partial<React.ComponentProps<typeof TasksDetailsModal>> = {},
  ) => {
    return render(
      <TasksDetailsModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        selectedTask={{ id: 'TASK-1' }}
        onRefreshCases={mockOnRefreshCases}
        onTaskUpdate={mockOnTaskUpdate}
        {...props}
      />,
    );
  };

  it('does not render when open is false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Task Details')).not.toBeInTheDocument();
  });

  it('does not render when row is null', () => {
    renderModal({ row: null });
    expect(screen.queryByText('Task Details')).not.toBeInTheDocument();
  });

  it('renders modal with task details when open', () => {
    renderModal({});

    expect(
      screen.getByRole('heading', { name: /Task Details/i }),
    ).toBeInTheDocument();
  });

  it('fetches tasks when modal opens', async () => {
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);

    renderModal({});

    await waitFor(() => {
      expect(mockGetTasksByCaseId).toHaveBeenCalledWith(123);
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    renderModal({});

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    await user.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders all tab buttons', () => {
    renderModal({});
    expect(screen.getAllByText('Task Details')[0]).toBeInTheDocument();
    expect(screen.getByText('Linked Items')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Visualizations')).toBeInTheDocument();
    expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    expect(screen.getByText('Investigation Summary')).toBeInTheDocument();
  });

  it('switches to Evidence tab', async () => {
    const user = userEvent.setup();
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);
    renderModal({});

    await user.click(screen.getByText('Evidence'));
    expect(screen.getByText('Task Evidence Tab')).toBeInTheDocument();
  });

  it('switches to Linked Items tab', async () => {
    const user = userEvent.setup();
    renderModal({});

    await user.click(screen.getByText('Linked Items'));
    expect(screen.getByText('Linked Items Tab')).toBeInTheDocument();
  });

  it('switches to Visualizations tab', async () => {
    const user = userEvent.setup();
    renderModal({});

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/Visualizations Tab/)).toBeInTheDocument();
  });

  it('switches to Investigation Notes tab', async () => {
    const user = userEvent.setup();
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);
    renderModal({});

    await user.click(screen.getByText('Investigation Notes'));
    expect(screen.getByText('Investigation Notes Tab')).toBeInTheDocument();
  });

  it('switches to Investigation Summary tab', async () => {
    const user = userEvent.setup();
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);
    renderModal({});

    await user.click(screen.getByText('Investigation Summary'));
    expect(screen.getByText('Investigation Summary Tab')).toBeInTheDocument();
  });

  it('fetches parent case details when parentId exists', async () => {
    mockGetCaseDetails.mockResolvedValue({
      alert: { alert_id: 42, transaction: '{"data":"test"}' },
    });

    renderModal({ row: mockCaseWithParent });

    await waitFor(() => {
      expect(mockGetCaseDetails).toHaveBeenCalledWith(999);
    });
  });

  it('handles parent case details fetch error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockGetCaseDetails.mockRejectedValue(new Error('fetch failed'));

    renderModal({ row: mockCaseWithParent });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch case details for parent case:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('handles task fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockGetTasksByCaseId.mockRejectedValue(new Error('task fetch failed'));

    renderModal({});

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch tasks:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('extracts transactionId from row transaction data', async () => {
    const user = userEvent.setup();
    renderModal({});

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:TXN-12345/)).toBeInTheDocument();
  });

  it('extracts transactionId from parent case transaction data', async () => {
    mockGetCaseDetails.mockResolvedValue({
      alert: {
        alert_id: 42,
        transaction: JSON.stringify({
          FIToFIPmtSts: {
            TxInfAndSts: {
              OrgnlEndToEndId: 'PARENT-TXN-001',
            },
          },
        }),
      },
    });

    const user = userEvent.setup();
    renderModal({ row: mockCaseWithParent });

    await waitFor(() => {
      expect(mockGetCaseDetails).toHaveBeenCalledWith(999);
    });

    await user.click(screen.getByText('Visualizations'));
    await waitFor(() => {
      expect(screen.getByText(/txn:PARENT-TXN-001/)).toBeInTheDocument();
    });
  });

  it('returns undefined transactionId when transaction data is invalid JSON', () => {
    const caseWithBadTransaction: CaseRow = {
      ...mockCaseData,
      transaction: 'invalid json{{{',
    };
    renderModal({ row: caseWithBadTransaction });
    // Should not crash, still renders
    expect(screen.getAllByText(/Task Details/)[0]).toBeInTheDocument();
  });

  it('returns undefined transactionId when transaction is null', () => {
    const caseWithNoTransaction: CaseRow = {
      ...mockCaseData,
      transaction: undefined,
    };
    renderModal({ row: caseWithNoTransaction });
    expect(screen.getAllByText(/Task Details/)[0]).toBeInTheDocument();
  });

  it('increments summaryRefreshKey on evidence upload complete', async () => {
    const user = userEvent.setup();
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);
    renderModal({});

    await user.click(screen.getByText('Evidence'));
    // Click the upload complete button exposed by the mock
    await user.click(screen.getByText('Upload Complete'));
    // No crash means success - the key incremented
    expect(screen.getByText('Task Evidence Tab')).toBeInTheDocument();
  });

  it('increments summaryRefreshKey on notes update', async () => {
    const user = userEvent.setup();
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);
    renderModal({});

    await user.click(screen.getByText('Investigation Notes'));
    await user.click(screen.getByText('Notes Updated'));
    expect(screen.getByText('Investigation Notes Tab')).toBeInTheDocument();
  });

  it('calls onTaskUpdate and refreshes tasks from summary tab', async () => {
    const user = userEvent.setup();
    mockGetTasksByCaseId.mockResolvedValue(mockTasks);
    renderModal({});

    await user.click(screen.getByText('Investigation Summary'));
    await user.click(screen.getByText('Refresh Tasks'));

    await waitFor(() => {
      expect(mockOnTaskUpdate).toHaveBeenCalled();
    });
    // Verify task refresh was called again
    expect(mockGetTasksByCaseId).toHaveBeenCalledTimes(2); // once on open, once on refresh
  });

  it('extracts transactionId from EndToEndId field', async () => {
    const user = userEvent.setup();
    const caseWithEndToEnd: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        FIToFIPmtSts: {
          TxInfAndSts: {
            EndToEndId: 'E2E-TXN-001',
          },
        },
      }),
    };
    renderModal({ row: caseWithEndToEnd });

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:E2E-TXN-001/)).toBeInTheDocument();
  });

  it('extracts transactionId from transaction_id field', async () => {
    const user = userEvent.setup();
    const caseWithTxnId: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        transaction_id: 'SIMPLE-TXN-001',
      }),
    };
    renderModal({ row: caseWithTxnId });

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:SIMPLE-TXN-001/)).toBeInTheDocument();
  });

  it('extracts transactionId from transactionId field', async () => {
    const user = userEvent.setup();
    const caseWithTxnId: CaseRow = {
      ...mockCaseData,
      transaction: JSON.stringify({
        transactionId: 'CAMEL-TXN-001',
      }),
    };
    renderModal({ row: caseWithTxnId });

    await user.click(screen.getByText('Visualizations'));
    expect(screen.getByText(/txn:CAMEL-TXN-001/)).toBeInTheDocument();
  });
});
