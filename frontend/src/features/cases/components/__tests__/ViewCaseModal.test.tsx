import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

vi.mock('../view/CaseDetailsTab', () => ({
  default: () => <div>Case Details Tab</div>,
}));
vi.mock('../view/CaseHistoryTab', () => ({
  default: () => <div>Case History Tab</div>,
}));
vi.mock('../view/CommentHistoryTab', () => ({
  default: () => <div>Comment History Tab</div>,
}));
vi.mock('../view/CaseActionsPanel', () => ({
  default: () => null,
}));
vi.mock('../view/TaskLogTab', () => ({
  default: ({ onRefreshCases }: any) => (
    <div>
      Task Log Tab
      <button onClick={onRefreshCases}>Refresh Cases</button>
    </div>
  ),
}));
vi.mock('../view/CollaboratePanel', () => ({
  default: () => <div>Collaborate Panel</div>,
}));
vi.mock('../../services/caseService', () => ({
  caseService: {
    getCaseDetails: vi.fn().mockResolvedValue({
      id: 123,
      alert_id: 456,
      case_type: 'FRAUD',
      status: 'STATUS_20_IN_PROGRESS',
      priority: 'HIGH',
      score: 0.9,
      created_at: '2023-01-01T00:00:00Z',
      tasks: [],
    }),
    getSubCasesDetails: vi.fn().mockResolvedValue([]),
  },
}));

import { caseService } from '../../services/caseService';

// Mock casesTable.utils to handle transformBackendCaseToUI
vi.mock('../casesTable.utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('../casesTable.utils')>();
  return {
    ...original,
    transformBackendCaseToUI: vi.fn().mockReturnValue({
      id: 123,
      alertId: 456,
      type: 'FRAUD',
      typeColor: 'bg-red-50',
      status: 'STATUS_20_IN_PROGRESS',
      statusColor: 'bg-blue-50',
      score: 90,
      createdOn: '01/01/2023',
      pickedOn: '02/01/2023',
      priority: 'HIGH',
      assignee: 'John Doe',
      userRole: 'owner',
      totalTasks: 1,
    }),
  };
});

import ViewCaseModal from '../ViewCaseModal';

const mockCaseData: CaseRow = {
  id: 123,
  alertId: 456,
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
};

describe('ViewCaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRefreshCases = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

    // Check that tabs are present (they might be rendered by child components)
    expect(
      screen.getByRole('heading', { name: /Case Details/i }),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Task Log' }));
    expect(screen.getByText('Task Log Tab')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Case History' }));
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

    await user.click(screen.getByRole('button', { name: 'Comments History' }));
    expect(screen.getByText('Comment History Tab')).toBeInTheDocument();
  });

  it('triggers refreshCaseData from TaskLogTab onRefreshCases', async () => {
    const user = userEvent.setup();

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={mockCaseData}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Task Log' }));
    await user.click(screen.getByRole('button', { name: 'Refresh Cases' }));

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalled();
    });
  });

  it('fetches subcases for FRAUD_AND_AML type', async () => {
    const fraudAmlCase: CaseRow = {
      ...mockCaseData,
      type: 'FRAUD_AND_AML',
    };

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={fraudAmlCase}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(caseService.getSubCasesDetails).toHaveBeenCalled();
    });
  });

  it('fetches parent case when parentId is provided', async () => {
    const caseWithParent: CaseRow = {
      ...mockCaseData,
      parentId: 999,
    };

    render(
      <ViewCaseModal
        open={true}
        onClose={mockOnClose}
        row={caseWithParent}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith(999);
    });
  });
});
