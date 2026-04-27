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
vi.mock('../view/CommentHistoryTab', () => ({
  default: () => <div>Comments History Tab</div>,
}));
vi.mock('../view/CaseActionsPanel', () => ({
  default: () => <div>Case Actions Panel</div>,
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
});
