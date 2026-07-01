import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseDetailsTab from '../CaseDetailsTab';
import type { CaseRow } from '../../casesTable.utils';

const mockGetAlertTransactionalData = vi.fn().mockResolvedValue([]);
vi.mock('../../../../alerts/services/triageservice', () => ({
  default: {
    getAlertTransactionalData: (...args: any[]) =>
      mockGetAlertTransactionalData(...args),
  },
}));

const mockGetCaseEvidence = vi.fn().mockResolvedValue({ evidence: [] });
const mockViewEvidence = vi.fn();
vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    getCaseEvidence: (...args: any[]) => mockGetCaseEvidence(...args),
    viewEvidence: (...args: any[]) => mockViewEvidence(...args),
  },
}));

const mockGetInvestigationTaskForCase = vi.fn();
vi.mock('../../../services/taskService', () => ({
  taskService: {
    getInvestigationTaskForCase: (...args: any[]) =>
      mockGetInvestigationTaskForCase(...args),
  },
}));

vi.mock('../../../hooks/useInvestigatorSupervisorList', () => ({
  default: () => ({
    supervisors: [],
    investigators: [],
    complianceOfficers: [],
    loadingInvestigators: false,
    loadingSupervisors: false,
    fetchInvestigatorsList: vi.fn(),
    fetchSupervisorsList: vi.fn(),
    fetchComplianceOfficersList: vi.fn(),
    getAssigneeFullName: (assignee?: string) =>
      assignee === 'user-1' ? 'John Doe' : (assignee ?? 'N/A'),
    clearCache: vi.fn(),
  }),
}));

vi.mock('../CaseActionsPanel', () => ({
  default: () => <div data-testid="case-actions-panel" />,
}));

vi.mock('@/features/alerts/components/AlertsDetailModal', () => ({
  default: ({
    alertId,
    isOpen,
  }: {
    alertId: number | null;
    isOpen: boolean;
  }) =>
    isOpen ? (
      <div data-testid="alerts-detail-modal">Alert details {alertId}</div>
    ) : null,
}));

vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: (s: string) => s,
}));

const mockCaseRow: CaseRow = {
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
  assignedUserId: 'user-1',
  confidencePercent: 85,
  alertMessage: 'Suspicious activity detected',
  transaction: {
    FIToFIPmtSts: {
      TxInfAndSts: {
        InstdAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'CREDITOR-FSP' } } },
        InstgAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'DEBTOR-FSP' } } },
      },
    },
  },
};

describe('CaseDetailsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCaseEvidence.mockResolvedValue({ evidence: [] });
    mockGetAlertTransactionalData.mockResolvedValue([]);
    mockGetInvestigationTaskForCase.mockResolvedValue({
      task_id: 1,
      case_id: 123,
      status: 'STATUS_20_IN_PROGRESS',
      assigned_user_id: 'user-1',
      name: 'Investigate Case',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });
  });

  it('renders case details', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('displays case information', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/FRAUD/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
    });
  });

  it('fetches transaction data when alertId is present', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(mockGetAlertTransactionalData).toHaveBeenCalledWith(1);
    });
  });

  it('renders alert information section', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Alert Information')).toBeInTheDocument();
    });
  });

  it('opens related alert details from alert information', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );

    fireEvent.click(await screen.findByTitle('View alert details'));

    expect(screen.getByTestId('alerts-detail-modal')).toHaveTextContent(
      'Alert details 1',
    );
  });

  it('does not fetch transaction data when alertId is missing', async () => {
    const rowWithoutAlert = { ...mockCaseRow, alertId: undefined };
    render(
      <CaseDetailsTab
        row={rowWithoutAlert}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
    expect(mockGetAlertTransactionalData).not.toHaveBeenCalled();
  });

  it('displays confidence score and alert message', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(
        screen.getByText('Suspicious activity detected'),
      ).toBeInTheDocument();
    });
  });

  it('renders pacs002 and pacs008 data with toggle', async () => {
    mockGetAlertTransactionalData.mockResolvedValue([
      { tx_type: 'pacs.002.001.12', pk: '1', amount: 100 },
      { tx_type: 'pacs.008.001.09', pk: '2', amount: 200 },
    ]);
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('pacs.002.001.12')).toBeInTheDocument();
    });
    // Toggle pacs002
    fireEvent.click(screen.getByText('pacs.002.001.12'));
    // Toggle pacs008
    fireEvent.click(screen.getByText('pacs.008.001.09'));
  });

  it('shows parent case info when parentId is set', async () => {
    const rowWithParent = { ...mockCaseRow, parentId: 100 } as any;
    const parentCase = {
      id: 100,
      status: 'STATUS_20_IN_PROGRESS',
      statusColor: 'bg-blue-50',
    } as any;
    render(
      <CaseDetailsTab
        row={rowWithParent}
        subCasesDetails={undefined}
        parentCaseDetails={parentCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Parent Case Information')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  it('shows sub-cases for FRAUD_AND_AML type', async () => {
    const famlRow = { ...mockCaseRow, type: 'FRAUD_AND_AML' };
    const subCases = [
      {
        id: 201,
        type: 'FRAUD',
        typeColor: 'bg-red-50',
        status: 'STATUS_20_IN_PROGRESS',
        statusColor: 'bg-blue-50',
      },
    ] as any[];
    render(
      <CaseDetailsTab
        row={famlRow}
        subCasesDetails={subCases}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Sub Case Information')).toBeInTheDocument();
      expect(screen.getByText('201')).toBeInTheDocument();
    });
  });

  it('shows investigation assignee from the investigation task', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );

    await waitFor(() => {
      expect(mockGetInvestigationTaskForCase).toHaveBeenCalledWith(123);
      expect(screen.getByText('Assignee')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('shows Unassigned when the investigation task has no assignee', async () => {
    mockGetInvestigationTaskForCase.mockResolvedValueOnce({
      task_id: 1,
      case_id: 123,
      status: 'STATUS_01_UNASSIGNED',
      assigned_user_id: null,
      name: 'Investigate Case',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    });

    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });
  });

  it('hides parent assignee for FRAUD_AND_AML and shows subcase assignees', async () => {
    const famlRow = { ...mockCaseRow, type: 'FRAUD_AND_AML' };
    const subCases = [
      {
        id: 201,
        type: 'AML',
        typeColor: 'bg-purple-50',
        status: 'STATUS_22_PENDING_FINAL_APPROVAL',
        statusColor: 'bg-purple-50',
      },
      {
        id: 202,
        type: 'FRAUD',
        typeColor: 'bg-red-50',
        status: 'STATUS_20_IN_PROGRESS',
        statusColor: 'bg-blue-50',
      },
    ] as CaseRow[];

    mockGetInvestigationTaskForCase.mockImplementation(async (caseId) => ({
      task_id: caseId,
      case_id: caseId,
      status: 'STATUS_20_IN_PROGRESS',
      assigned_user_id: caseId === 201 ? 'user-1' : null,
      name: 'Investigate Case',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }));

    render(
      <CaseDetailsTab
        row={famlRow}
        subCasesDetails={subCases}
        parentCaseDetails={null}
      />,
    );

    await waitFor(() => {
      expect(mockGetInvestigationTaskForCase).not.toHaveBeenCalledWith(123);
      expect(mockGetInvestigationTaskForCase).toHaveBeenCalledWith(201);
      expect(mockGetInvestigationTaskForCase).toHaveBeenCalledWith(202);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });
  });

  it('shows loading state when loading reports', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockImplementation(() => new Promise(() => {}));
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Loading case details…')).toBeInTheDocument();
    });
  });

  it('shows View Investigation Report button for closed cases with reports', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2024-01-01' }],
        },
      ],
    });
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
  });

  it('does not show report button for in-progress cases', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('View Investigation Report'),
    ).not.toBeInTheDocument();
  });

  it('renders CaseActionsPanel when showActions is true', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        showActions={true}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('case-actions-panel')).toBeInTheDocument();
    });
  });

  it('hides CaseActionsPanel when showActions is false', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        showActions={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('case-actions-panel')).not.toBeInTheDocument();
  });

  it('does not show alert section when alertId is missing', async () => {
    const rowWithoutAlert = { ...mockCaseRow, alertId: undefined };
    render(
      <CaseDetailsTab
        row={rowWithoutAlert}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alert Information')).not.toBeInTheDocument();
  });

  it('handles transaction data fetch error', async () => {
    mockGetAlertTransactionalData.mockRejectedValue(new Error('Network error'));
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('handles evidence loading error for closed cases', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockRejectedValue(new Error('Failed'));
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('displays createdOn date', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('01/01/2023')).toBeInTheDocument();
    });
  });

  it('shows 0% for missing confidence percent', async () => {
    const rowNoConf = { ...mockCaseRow, confidencePercent: undefined };
    render(
      <CaseDetailsTab
        row={rowNoConf}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('shows View Investigation Report and handles click for previewable file', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-001',
          attachments: [{ submittedAt: '2024-01-01' }],
        },
      ],
    });
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    mockViewEvidence.mockResolvedValue(mockBlob);
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
    const mockWindowOpen = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null);
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('View Investigation Report'));
    await waitFor(() => {
      expect(mockViewEvidence).toHaveBeenCalledWith('RPT-001');
    });
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled();
    });
    mockWindowOpen.mockRestore();
  });

  it('handles handleViewReport with non-previewable file type', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-002',
          attachments: [{ submittedAt: '2024-01-01' }],
        },
      ],
    });
    const mockBlob = new Blob(['data'], { type: 'application/zip' });
    mockViewEvidence.mockResolvedValue(mockBlob);
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('View Investigation Report'));
    await waitFor(() => {
      expect(mockViewEvidence).toHaveBeenCalledWith('RPT-002');
    });
  });

  it('handles handleViewReport error', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-ERR',
          attachments: [{ submittedAt: '2024-01-01' }],
        },
      ],
    });
    mockViewEvidence.mockRejectedValue(new Error('View failed'));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('View Investigation Report'));
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  it('renders confidence score with correct percentage', async () => {
    const highScoreRow = { ...mockCaseRow, confidencePercent: 95 };
    render(
      <CaseDetailsTab
        row={highScoreRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });

  it('displays pacs.002 JSON data when toggled open', async () => {
    mockGetAlertTransactionalData.mockResolvedValue([
      { tx_type: 'pacs.002.001.12', pk: '1', amount: 100, currency: 'USD' },
    ]);
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('pacs.002.001.12')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('pacs.002.001.12'));
    await waitFor(() => {
      expect(screen.getByText(/amount/i)).toBeInTheDocument();
    });
  });

  it('picks latest report when multiple evidence exist', async () => {
    const closedRow = { ...mockCaseRow, status: 'STATUS_82_CLOSED_CONFIRMED' };
    mockGetCaseEvidence.mockResolvedValue({
      evidence: [
        {
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-OLD',
          attachments: [{ submittedAt: '2024-01-01' }],
        },
        {
          evidenceType: 'INVESTIGATION_REPORT',
          reportId: 'RPT-NEW',
          attachments: [{ submittedAt: '2024-06-01' }],
        },
      ],
    });
    render(
      <CaseDetailsTab
        row={closedRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('View Investigation Report')).toBeInTheDocument();
    });
  });

  it('shows created date', async () => {
    render(
      <CaseDetailsTab
        row={mockCaseRow}
        subCasesDetails={undefined}
        parentCaseDetails={null}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('01/01/2023')).toBeInTheDocument();
    });
  });
});
