import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseDetailsTab from '../CaseDetailsTab';
import type { CaseRow } from '../../casesTable.utils';

vi.mock('../../../../alerts/services/triageservice', () => ({
  default: {
    getAlertTransactionalData: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    getCaseEvidence: vi.fn().mockResolvedValue({ evidence: [] }),
    viewEvidence: vi.fn(),
  },
}));

vi.mock('../CaseActionsPanel', () => ({
  default: () => <div data-testid="case-actions-panel" />,
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
  transaction: {
    FIToFIPmtSts: {
      TxInfAndSts: {
        InstdAgt: {
          FinInstnId: {
            ClrSysMmbId: {
              MmbId: 'CREDITOR-FSP',
            },
          },
        },
        InstgAgt: {
          FinInstnId: {
            ClrSysMmbId: {
              MmbId: 'DEBTOR-FSP',
            },
          },
        },
      },
    },
  },
};

describe('CaseDetailsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders case details', async () => {
    render(<CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />);

    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('displays case information', async () => {
    render(<CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />);

    await waitFor(() => {
      expect(screen.getByText(/FRAUD/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
    });
  });

  it('fetches transaction data when alertId is present', async () => {
    const triageService = await import('../../../../alerts/services/triageservice');
    render(<CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />);

    await waitFor(() => {
      expect(triageService.default.getAlertTransactionalData).toHaveBeenCalledWith(1);
    });
  });

  it('renders alert information section', async () => {
    render(<CaseDetailsTab row={mockCaseRow} subCasesDetails={undefined} parentCaseDetails={null} />);

    await waitFor(() => {
      expect(screen.getByText('Alert Information')).toBeInTheDocument();
    });
  });

  it('does not fetch transaction data when alertId is missing', async () => {
    const triageService = await import('../../../../alerts/services/triageservice');
    const rowWithoutAlert = { ...mockCaseRow, alertId: undefined };
    render(<CaseDetailsTab row={rowWithoutAlert} subCasesDetails={undefined} parentCaseDetails={null} />);

    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });

    expect(triageService.default.getAlertTransactionalData).not.toHaveBeenCalled();
  });
});
