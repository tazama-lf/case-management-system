import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseDetailsTab from '../CaseDetailsTab';
import type { CaseRow } from '../../casesTable.utils';
import userService from '../../../services/userService';

vi.mock('../../../services/userService');

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
    (userService.getUserDetailsById as vi.Mock).mockResolvedValue({
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      username: 'jdoe',
    });
  });

  it('renders case details', async () => {
    render(<CaseDetailsTab row={mockCaseRow} />);

    await waitFor(() => {
      expect(screen.getByText('CASE-123')).toBeInTheDocument();
    });
  });

  it('displays case information', async () => {
    render(<CaseDetailsTab row={mockCaseRow} />);

    await waitFor(() => {
      expect(screen.getByText(/FRAUD/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
    });
  });

  it('fetches user details when assignedUserId is present', async () => {
    render(<CaseDetailsTab row={mockCaseRow} />);

    await waitFor(() => {
      expect(userService.getUserDetailsById).toHaveBeenCalledWith('user-1');
    });
  });

  it('displays transaction creditor and debtor information', async () => {
    render(<CaseDetailsTab row={mockCaseRow} />);

    await waitFor(() => {
      expect(screen.getByText('CREDITOR-FSP')).toBeInTheDocument();
      expect(screen.getByText('DEBTOR-FSP')).toBeInTheDocument();
    });
  });

  it('handles missing assignedUserId gracefully', async () => {
    const rowWithoutUserId = { ...mockCaseRow, assignedUserId: undefined };
    render(<CaseDetailsTab row={rowWithoutUserId} />);

    await waitFor(() => {
      expect(screen.getByText('CASE-123')).toBeInTheDocument();
    });

    expect(userService.getUserDetailsById).not.toHaveBeenCalled();
  });
});
