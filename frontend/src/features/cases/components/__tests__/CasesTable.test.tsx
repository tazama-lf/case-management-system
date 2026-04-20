import { render, screen, userEvent } from '../../../../test/testUtils';
import { describe, it, expect, vi } from 'vitest';
import CasesTable from '../CasesTable';
import type { CaseRow } from '../casesTable.utils';

describe('CasesTable', () => {
  const mockRows: CaseRow[] = [
    {
      id: 1,
      type: 'FRAUD',
      typeColor: 'bg-red-50 text-red-700',
      status: 'STATUS_20_IN_PROGRESS',
      statusColor: 'bg-yellow-50 text-yellow-700',
      typologyId: 'TYP-001',
      score: 85,
      createdOn: '2023-01-01',
      pickedOn: '2023-01-02',
      action: 'View',
      assignee: 'User 1',
      priority: 'HIGH',
      userRole: 'owner',
      totalTasks: 5,
      alertId: 1,
    },
    {
      id: 2,
      type: 'AML',
      typeColor: 'bg-purple-50 text-purple-700',
      status: 'STATUS_00_DRAFT',
      statusColor: 'bg-gray-100 text-gray-700',
      typologyId: 'TYP-002',
      score: 45,
      createdOn: '2023-01-03',
      pickedOn: '-',
      action: 'Complete',
      assignee: 'Unassigned',
      priority: 'LOW',
      userRole: 'none',
      totalTasks: 0,
      alertId: 2,
    },
  ];

  const defaultProps = {
    rows: mockRows,
    onView: vi.fn(),
    onComplete: vi.fn(),
    onCloseCase: vi.fn(),
    onReopenCase: vi.fn(),
    onAbandonCase: vi.fn(),
    onSuspendCase: vi.fn(),
    onResumeCase: vi.fn(),
    onApproveCase: vi.fn(),
    onApproveCaseReopen: vi.fn(),
    onRejectCaseReopen: vi.fn(),
    onApproveCaseCreation: vi.fn(),
    onRejectCaseCreation: vi.fn(),
    canManageSupervisorActions: false,
    pagination: {
      currentPage: 1,
      pageSize: 10,
      totalItems: 20,
      totalPages: 2,
      onPageChange: vi.fn(),
    },
  };

  it('should render table headers correctly', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Case Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should render case rows correctly', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.getByText('CASE-001')).toBeInTheDocument();
    expect(screen.getByText('FRAUD')).toBeInTheDocument();
    expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();

    expect(screen.getByText('CASE-002')).toBeInTheDocument();
    expect(screen.getByText('AML')).toBeInTheDocument();
    expect(screen.getByText('STATUS_00_DRAFT')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('should call onView when review button is clicked', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const reviewButtons = screen.getAllByText('Review');
    await user.click(reviewButtons[0]);

    expect(defaultProps.onView).toHaveBeenCalledWith(mockRows[0]);
  });

  it('should show Complete button for draft cases', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const completeButton = screen.getByText('Complete');
    expect(completeButton).toBeInTheDocument();

    await user.click(completeButton);
    expect(defaultProps.onComplete).toHaveBeenCalledWith(mockRows[1]);
  });

  it('should show Close Case button for in-progress cases', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const closeButton = screen.getByText('Close Case');
    expect(closeButton).toBeInTheDocument();

    await user.click(closeButton);
    expect(defaultProps.onCloseCase).toHaveBeenCalledWith(mockRows[0]);
  });

  it('should show Abandon button for draft cases', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const abandonButton = screen.getByText('Abandon');
    expect(abandonButton).toBeInTheDocument();

    await user.click(abandonButton);
    expect(defaultProps.onAbandonCase).toHaveBeenCalledWith(mockRows[1]);
  });

  it('should render pagination controls', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText(/results/i)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should call onPageChange when pagination buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(defaultProps.pagination.onPageChange).toHaveBeenCalledWith(2);
  });

  it('should show supervisor controls when enabled and status matches', async () => {
    const supervisorRows: CaseRow[] = [
      {
        ...mockRows[0],
        id: 101,
        status: 'STATUS_22_PENDING_FINAL_APPROVAL',
      },
      {
        ...mockRows[0],
        id: 102,
        status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
      },
    ];

    const user = userEvent.setup();
    render(
      <CasesTable
        {...defaultProps}
        rows={supervisorRows}
        canManageSupervisorActions={true}
      />,
    );

    // Check for Review Case Closure
    const reviewClosureBtn = screen.getByText('Review Case Closure');
    expect(reviewClosureBtn).toBeInTheDocument();
    await user.click(reviewClosureBtn);
    expect(defaultProps.onApproveCase).toHaveBeenCalledWith(supervisorRows[0]);

    // Check for Approve/Reject Creation
    const approveCreationBtn = screen.getByText('Approve');
    const rejectCreationBtn = screen.getByText('Reject');
    expect(approveCreationBtn).toBeInTheDocument();
    expect(rejectCreationBtn).toBeInTheDocument();

    await user.click(approveCreationBtn);
    expect(defaultProps.onApproveCaseCreation).toHaveBeenCalledWith(
      supervisorRows[1],
    );
  });

  it('should NOT show supervisor controls when disabled', () => {
    const supervisorRows: CaseRow[] = [
      {
        ...mockRows[0],
        id: 101,
        status: 'STATUS_22_PENDING_FINAL_APPROVAL',
      },
    ];

    render(
      <CasesTable
        {...defaultProps}
        rows={supervisorRows}
        canManageSupervisorActions={false}
      />,
    );

    expect(screen.queryByText('Review Case Closure')).not.toBeInTheDocument();
  });
});
