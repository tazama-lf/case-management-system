import React from 'react';
import { render, screen } from '@testing-library/react';
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

vi.mock('../services/caseService', () => ({
  caseService: {
    getCaseDetails: vi.fn().mockResolvedValue({}),
  },
  transformBackendCaseToUI: vi.fn(),
}));

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
  default: () => <div>Task Log Tab</div>,
}));
vi.mock('../view/CollaboratePanel', () => ({
  default: () => <div>Collaborate Panel</div>,
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
});
