import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseDetailTaskLogTable from '../CaseDetailTaskLogTable';

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d || 'N/A',
}));

vi.mock('@/shared/components/ui', () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      {title} {description}
    </div>
  ),
}));

vi.mock('@/features/alerts/hooks/useAlertsQuery', () => ({
  useAlertOperations: () => ({}),
}));

vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'user-1', username: 'test' }),
  },
}));

const mockHasComplianceOfficerRole = vi.fn(() => false);
const mockHasSupervisorRole = vi.fn(() => false);
const mockHasInvestigatorRole = vi.fn(() => true);
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
    hasSupervisorRole: mockHasSupervisorRole,
    hasInvestigatorRole: mockHasInvestigatorRole,
  }),
}));

const mockInvestigators = [{ id: 'inv-1', firstName: 'John', lastName: 'Doe' }];
const mockSupervisors = [{ id: 'sup-1', firstName: 'Jane', lastName: 'Smith' }];
const mockComplianceOfficers = [
  { id: 'comp-1', firstName: 'Bob', lastName: 'Jones' },
];
vi.mock('@/features/cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: () => ({
    investigators: mockInvestigators,
    supervisors: mockSupervisors,
    complianceOfficers: mockComplianceOfficers,
    fetchInvestigatorsList: vi.fn(),
    fetchSupervisorsList: vi.fn(),
    fetchComplianceOfficersList: vi.fn(),
  }),
}));

describe('CaseDetailTaskLogTable', () => {
  const caseData = { status: 'STATUS_20_IN_PROGRESS' };

  const baseTasks = [
    {
      id: 1,
      taskId: 101,
      name: 'Investigate Alert',
      status: 'UNASSIGNED',
      created: '2024-01-01',
      assignee: null,
      assigneeName: null,
      candidateGroup: 'investigators',
      caseId: 100,
    },
  ] as any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasComplianceOfficerRole.mockReturnValue(false);
    mockHasSupervisorRole.mockReturnValue(false);
    mockHasInvestigatorRole.mockReturnValue(true);
  });

  it('renders task table with tasks', () => {
    render(
      <CaseDetailTaskLogTable
        tasks={baseTasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('Task ID')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    render(
      <CaseDetailTaskLogTable
        tasks={[]}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('shows assign button for unassigned tasks', () => {
    const onAssign = vi.fn();
    render(
      <CaseDetailTaskLogTable
        tasks={baseTasks}
        onAssign={onAssign}
        caseData={caseData}
      />,
    );
    const assignBtn = screen.getByTitle('Assign task');
    fireEvent.click(assignBtn);
    expect(onAssign).toHaveBeenCalledWith(baseTasks[0]);
  });

  it('shows reassign and unassign for assigned tasks', () => {
    const onReassign = vi.fn();
    const onUnassign = vi.fn();
    const tasks = [
      { ...baseTasks[0], status: 'IN_PROGRESS', assignee: 'user-1' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onReassign={onReassign}
        onUnassign={onUnassign}
        caseData={caseData}
      />,
    );
    const reassignBtn = screen.getByTitle('Reassign task');
    fireEvent.click(reassignBtn);
    expect(onReassign).toHaveBeenCalledWith(tasks[0]);
    const unassignBtn = screen.getByTitle('Unassign task');
    fireEvent.click(unassignBtn);
    expect(onUnassign).toHaveBeenCalledWith(tasks[0]);
  });

  it('shows view action for investigation tasks', () => {
    const onTaskClick = vi.fn();
    const tasks = [
      { ...baseTasks[0], status: 'IN_PROGRESS', assignee: 'user-1' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onTaskClick={onTaskClick}
        caseData={caseData}
      />,
    );
    const viewBtn = screen.getByTitle('View task');
    fireEvent.click(viewBtn);
    expect(onTaskClick).toHaveBeenCalledWith(tasks[0]);
  });

  it('hides compliance queue tasks from investigators', () => {
    mockHasInvestigatorRole.mockReturnValue(true);
    mockHasSupervisorRole.mockReturnValue(false);
    const tasks = [
      { ...baseTasks[0], candidateGroup: 'compliance', name: 'SAR/STR Filing' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.queryByText('SAR/STR Filing')).not.toBeInTheDocument();
  });

  it('shows compliance queue tasks to supervisors', () => {
    mockHasSupervisorRole.mockReturnValue(true);
    const tasks = [
      { ...baseTasks[0], candidateGroup: 'compliance', name: 'SAR/STR Filing' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
  });

  it('displays status badges correctly', () => {
    const statuses = [
      'UNASSIGNED',
      'ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
      'SUSPENDED',
    ];
    const labels = [
      'Unassigned',
      'Assigned',
      'In Progress',
      'Completed',
      'Blocked',
    ];
    statuses.forEach((status, i) => {
      const tasks = [
        { ...baseTasks[0], status, assignee: 'inv-1', assigneeName: 'inv-1' },
      ];
      const { unmount } = render(
        <CaseDetailTaskLogTable
          tasks={tasks}
          onAssign={vi.fn()}
          caseData={caseData}
        />,
      );
      expect(screen.getByText(labels[i])).toBeInTheDocument();
      unmount();
    });
  });

  it('resolves assignee full name from investigators', () => {
    const tasks = [
      {
        ...baseTasks[0],
        status: 'ASSIGNED',
        assignee: 'inv-1',
        assigneeName: 'inv-1',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('resolves assignee full name from supervisors', () => {
    const tasks = [
      {
        ...baseTasks[0],
        status: 'ASSIGNED',
        assignee: 'sup-1',
        assigneeName: 'sup-1',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('resolves assignee full name from compliance officers', () => {
    const tasks = [
      {
        ...baseTasks[0],
        status: 'ASSIGNED',
        assignee: 'comp-1',
        assigneeName: 'comp-1',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('falls back to assignee name when user not found', () => {
    const tasks = [
      {
        ...baseTasks[0],
        status: 'ASSIGNED',
        assignee: 'unknown-user',
        assigneeName: 'unknown-user',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('unknown-user')).toBeInTheDocument();
  });

  it('shows Unassigned for tasks without assignee', () => {
    const tasks = [
      {
        ...baseTasks[0],
        status: 'IN_PROGRESS',
        assignee: null,
        assigneeName: null,
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    const unassignedElements = screen.getAllByText('Unassigned');
    expect(unassignedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('getCandidateGroup returns Investigators for investigate tasks', () => {
    const tasks = [
      { ...baseTasks[0], candidateGroup: 'random', name: 'Investigate Alert' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('Investigators')).toBeInTheDocument();
  });

  it('getCandidateGroup capitalizes candidate group', () => {
    const tasks = [
      { ...baseTasks[0], candidateGroup: 'supervisors', name: 'Approve Case' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('Supervisors')).toBeInTheDocument();
  });

  it('getCandidateGroup shows dash when no group', () => {
    const tasks = [
      { ...baseTasks[0], candidateGroup: undefined, name: 'Some Task' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('completed tasks have no action buttons except view for SAR tasks', () => {
    const tasks = [
      { ...baseTasks[0], status: 'COMPLETED', name: 'SAR/STR Filing' },
    ];
    const onTaskClick = vi.fn();
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onTaskClick={onTaskClick}
        caseData={caseData}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  it('completed investigation tasks have view action', () => {
    const tasks = [
      { ...baseTasks[0], status: 'COMPLETED', name: 'Investigate Case' },
    ];
    const onTaskClick = vi.fn();
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onTaskClick={onTaskClick}
        caseData={caseData}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  it('suspended tasks only show view action', () => {
    const tasks = [
      { ...baseTasks[0], status: 'SUSPENDED', name: 'Investigate Alert' },
    ];
    const suspendedCase = { status: 'STATUS_21_SUSPENDED' };
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onTaskClick={vi.fn()}
        caseData={suspendedCase}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  it('SAR/STR Filing unassigned shows no actions for non-compliance officer', () => {
    mockHasComplianceOfficerRole.mockReturnValue(false);
    mockHasSupervisorRole.mockReturnValue(true);
    const tasks = [
      { ...baseTasks[0], status: 'UNASSIGNED', name: 'SAR/STR Filing' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  it('SAR/STR Filing assigned shows view for non-compliance officer', () => {
    mockHasComplianceOfficerRole.mockReturnValue(false);
    mockHasSupervisorRole.mockReturnValue(true);
    const tasks = [
      {
        ...baseTasks[0],
        status: 'ASSIGNED',
        assignee: 'user-2',
        name: 'SAR/STR Filing',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onTaskClick={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  it('shows approve/reject creation actions for supervisor', () => {
    const onApproveCaseCreation = vi.fn();
    const onRejectCaseCreation = vi.fn();
    const tasks = [
      {
        ...baseTasks[0],
        status: 'IN_PROGRESS',
        assignee: 'user-1',
        name: 'Approve Case Creation',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        canManageSupervisorActions={true}
        caseData={caseData}
        onApproveCaseCreation={onApproveCaseCreation}
        onRejectCaseCreation={onRejectCaseCreation}
      />,
    );
    const approveBtns = screen.getAllByTitle('Approve Case Creation');
    const approveBtn = approveBtns.find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(approveBtn);
    expect(onApproveCaseCreation).toHaveBeenCalledWith(caseData);
    const rejectBtn = screen.getByTitle('Reject Case Creation');
    fireEvent.click(rejectBtn);
    expect(onRejectCaseCreation).toHaveBeenCalledWith(caseData);
  });

  it('shows approve closure action for supervisor', () => {
    const onApproveCase = vi.fn();
    const tasks = [
      {
        ...baseTasks[0],
        status: 'IN_PROGRESS',
        assignee: 'user-1',
        name: 'Approve Case Closure',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        canManageSupervisorActions={true}
        caseData={caseData}
        onApproveCase={onApproveCase}
      />,
    );
    const reviewBtn = screen.getByTitle('Review Case Closure');
    fireEvent.click(reviewBtn);
    expect(onApproveCase).toHaveBeenCalledWith(caseData);
  });

  it('shows update status action for assigned current user', () => {
    const onUpdateStatus = vi.fn();
    const tasks = [
      {
        ...baseTasks[0],
        status: 'ASSIGNED',
        assignee: 'user-1',
        name: 'Review Task',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        caseData={caseData}
      />,
    );
    const statusBtn = screen.getByTitle('Update status');
    fireEvent.click(statusBtn);
    expect(onUpdateStatus).toHaveBeenCalledWith(tasks[0]);
  });

  it('does not show update status for suspended tasks', () => {
    const onUpdateStatus = vi.fn();
    const tasks = [
      {
        ...baseTasks[0],
        status: 'SUSPENDED',
        assignee: 'user-1',
        name: 'Review Task',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        caseData={{ status: 'STATUS_20_IN_PROGRESS' }}
      />,
    );
    expect(screen.queryByTitle('Update status')).not.toBeInTheDocument();
  });

  it('does not show assign button for approval tasks', () => {
    const tasks = [
      { ...baseTasks[0], status: 'UNASSIGNED', name: 'Approve Case Closure' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  it('complete new case task has no actions', () => {
    const tasks = [
      { ...baseTasks[0], status: 'UNASSIGNED', name: 'complete new case' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  it('shows all columns', () => {
    render(
      <CaseDetailTaskLogTable
        tasks={baseTasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    [
      'Task ID',
      'Task',
      'Case',
      'Status',
      'Created',
      'Assigned To',
      'Actions',
    ].forEach((col) => {
      expect(screen.getByText(col)).toBeInTheDocument();
    });
  });

  it('displays task id and case id', () => {
    render(
      <CaseDetailTaskLogTable
        tasks={baseTasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('TASK-101')).toBeInTheDocument();
    expect(screen.getByText('CASE-100')).toBeInTheDocument();
  });

  it('compliance officer sees all tasks', () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    const tasks = [
      { ...baseTasks[0], candidateGroup: 'compliance', name: 'SAR/STR Filing' },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        caseData={caseData}
      />,
    );
    expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
  });

  it('view non-clickable task does not call onTaskClick', () => {
    const onTaskClick = vi.fn();
    const tasks = [
      {
        ...baseTasks[0],
        status: 'IN_PROGRESS',
        assignee: 'user-1',
        name: 'Some Random Task',
      },
    ];
    render(
      <CaseDetailTaskLogTable
        tasks={tasks}
        onAssign={vi.fn()}
        onTaskClick={onTaskClick}
        caseData={caseData}
      />,
    );
    const viewBtn = screen.getByTitle('View task');
    fireEvent.click(viewBtn);
    // Non-investigation tasks are not clickable
    expect(onTaskClick).not.toHaveBeenCalled();
  });
});
