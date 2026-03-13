import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseDetailTaskLogTable from '../CaseDetailTaskLogTable';
import type { UnifiedWorkQueueTask } from '../../../types/task.types';

// ── Mocks ──

const mockHasComplianceOfficerRole = vi.fn().mockReturnValue(false);
const mockHasSupervisorRole = vi.fn().mockReturnValue(false);
const mockHasInvestigatorRole = vi.fn().mockReturnValue(false);

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
    hasSupervisorRole: mockHasSupervisorRole,
    hasInvestigatorRole: mockHasInvestigatorRole,
  }),
}));

vi.mock('@/features/alerts/hooks/useAlertsQuery', () => ({
  useAlertOperations: () => ({}),
}));

vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'current-user', fullName: 'Current User' }),
  },
}));

const mockInvestigators = [
  { id: 'inv-1', firstName: 'Alice', lastName: 'Investigator' },
];
const mockSupervisors = [
  { id: 'sup-1', firstName: 'Bob', lastName: 'Supervisor' },
];
const mockComplianceOfficers = [
  { id: 'comp-1', firstName: 'Carol', lastName: 'Compliance' },
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

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d || 'N/A',
}));

vi.mock('@/shared/components/ui', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}));

// ── Helpers ──

const createTask = (overrides: Partial<UnifiedWorkQueueTask> = {}): UnifiedWorkQueueTask => ({
  id: 1,
  taskId: 100,
  name: 'Investigate Case',
  status: 'ASSIGNED',
  assignee: 'inv-1',
  assigneeName: 'inv-1',
  candidateGroup: 'investigations',
  caseId: 123,
  created: '2024-01-01',
  ...overrides,
});

const getActionButton = (container: HTMLElement, title: string) =>
  container.querySelector(`button[title="${title}"]`);

const defaultProps = {
  tasks: [] as UnifiedWorkQueueTask[],
  onAssign: vi.fn(),
};

describe('CaseDetailTaskLogTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasComplianceOfficerRole.mockReturnValue(false);
    mockHasSupervisorRole.mockReturnValue(false);
    mockHasInvestigatorRole.mockReturnValue(false);
  });

  // ── Basic Rendering ──

  it('renders table headers', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask()]} />);
    expect(screen.getByText('Task ID')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Case')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Assigned To')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
  });

  it('renders task row with task ID and case ID', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask()]} />);
    expect(screen.getByText(/TASK-/)).toBeInTheDocument();
    expect(screen.getByText(/CASE-/)).toBeInTheDocument();
  });

  it('renders task name', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ name: 'Investigate Case' })]} />);
    expect(screen.getByText('Investigate Case')).toBeInTheDocument();
  });

  it('renders created date via formatDate', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ created: '2024-01-15' })]} />);
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  // ── getStatusBadge ──

  it('renders Unassigned badge', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ status: 'UNASSIGNED' })]} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('renders Assigned badge', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ status: 'ASSIGNED' })]} />);
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('renders In Progress badge', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ status: 'IN_PROGRESS' })]} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders Completed badge', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ status: 'COMPLETED' })]} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders Blocked badge for SUSPENDED status', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ status: 'SUSPENDED' })]} />);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('renders Unassigned badge for unknown status', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ status: 'UNKNOWN' })]} />);
    // Falls back to UNASSIGNED config
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  // ── getCandidateGroup ──

  it('shows Investigators for investigate tasks', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ name: 'Investigate Case' })]} />);
    expect(screen.getByText('Investigators')).toBeInTheDocument();
  });

  it('capitalizes candidateGroup', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ name: 'Approve Case Closure', candidateGroup: 'supervisors' })]}
      />,
    );
    expect(screen.getByText('Supervisors')).toBeInTheDocument();
  });

  it('shows dash for missing candidateGroup on non-investigate tasks', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ name: 'Some Task', candidateGroup: undefined })]}
      />,
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  // ── getAssigneeFullName ──

  it('shows investigator full name', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ assignee: 'inv-1' })]} />);
    expect(screen.getByText('Alice Investigator')).toBeInTheDocument();
  });

  it('shows supervisor full name', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ assignee: 'sup-1', assigneeName: 'sup-1' })]} />);
    expect(screen.getByText('Bob Supervisor')).toBeInTheDocument();
  });

  it('shows compliance officer full name', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ assignee: 'comp-1' })]} />);
    expect(screen.getByText('Carol Compliance')).toBeInTheDocument();
  });

  it('falls back to assignee id when not found in lists', () => {
    render(<CaseDetailTaskLogTable {...defaultProps} tasks={[createTask({ assignee: 'unknown-user', assigneeName: 'unknown-user' })]} />);
    expect(screen.getByText('unknown-user')).toBeInTheDocument();
  });

  it('shows Unassigned text when no assignee', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ assignee: undefined, assigneeName: undefined })]}
      />,
    );
    const unassignedTexts = screen.getAllByText('Unassigned');
    expect(unassignedTexts.length).toBeGreaterThan(0);
  });

  // ── filteredTasks ──

  it('hides compliance tasks for investigator-only users', () => {
    mockHasInvestigatorRole.mockReturnValue(true);
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[
          createTask({ id: 1, name: 'Investigate Case', candidateGroup: 'investigations' }),
          createTask({ id: 2, name: 'SAR/STR Filing', candidateGroup: 'compliance' }),
        ]}
      />,
    );
    expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    expect(screen.queryByText('SAR/STR Filing')).not.toBeInTheDocument();
  });

  it('shows all tasks including compliance for supervisors', () => {
    mockHasSupervisorRole.mockReturnValue(true);
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[
          createTask({ id: 1, name: 'Investigate Case' }),
          createTask({ id: 2, name: 'SAR/STR Filing', candidateGroup: 'compliance' }),
        ]}
      />,
    );
    expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
  });

  it('shows all tasks including compliance for compliance officers', () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[
          createTask({ id: 1, name: 'Investigate Case' }),
          createTask({ id: 2, name: 'SAR/STR Filing', candidateGroup: 'compliance' }),
        ]}
      />,
    );
    expect(screen.getByText('Investigate Case')).toBeInTheDocument();
    expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
  });

  // ── Action: Assign (default flow for non-special tasks) ──

  it('shows assign button for unassigned non-approval task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ status: 'UNASSIGNED', assignee: undefined })]}
      />,
    );
    expect(screen.getByTitle('Assign task')).toBeInTheDocument();
  });

  it('calls onAssign when assign button clicked', () => {
    const onAssign = vi.fn();
    const task = createTask({ status: 'UNASSIGNED', assignee: undefined });
    render(<CaseDetailTaskLogTable {...defaultProps} onAssign={onAssign} tasks={[task]} />);

    fireEvent.click(screen.getByTitle('Assign task'));
    expect(onAssign).toHaveBeenCalledWith(task);
  });

  it('does not show assign button for Approve Case Closure task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ status: 'UNASSIGNED', assignee: undefined, name: 'Approve Case Closure' })]}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  it('does not show assign button for Approve Case Creation task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ status: 'UNASSIGNED', assignee: undefined, name: 'Approve Case Creation' })]}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  // ── Action: Reassign ──

  it('shows reassign button for assigned task when onReassign provided', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onReassign={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', assignee: 'inv-1' })]}
      />,
    );
    expect(screen.getByTitle('Reassign task')).toBeInTheDocument();
  });

  it('calls onReassign when clicked', () => {
    const onReassign = vi.fn();
    const task = createTask({ status: 'ASSIGNED', assignee: 'inv-1' });
    render(<CaseDetailTaskLogTable {...defaultProps} onReassign={onReassign} tasks={[task]} />);

    fireEvent.click(screen.getByTitle('Reassign task'));
    expect(onReassign).toHaveBeenCalledWith(task);
  });

  // ── Action: Unassign ──

  it('shows unassign button for assigned task when onUnassign provided', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onUnassign={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', assignee: 'inv-1' })]}
      />,
    );
    expect(screen.getByTitle('Unassign task')).toBeInTheDocument();
  });

  it('calls onUnassign when clicked', () => {
    const onUnassign = vi.fn();
    const task = createTask({ status: 'ASSIGNED', assignee: 'inv-1' });
    render(<CaseDetailTaskLogTable {...defaultProps} onUnassign={onUnassign} tasks={[task]} />);

    fireEvent.click(screen.getByTitle('Unassign task'));
    expect(onUnassign).toHaveBeenCalledWith(task);
  });

  // ── Action: View (only on IN_PROGRESS, COMPLETED SAR/investigate, SUSPENDED+suspended, SAR non-compliance) ──

  it('shows view button for in-progress investigation task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Investigate Case', assignee: 'inv-1' })]}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  it('calls onTaskClick for in-progress investigate task', () => {
    const onTaskClick = vi.fn();
    const task = createTask({ status: 'IN_PROGRESS', name: 'Investigate Case', assignee: 'inv-1' });
    render(<CaseDetailTaskLogTable {...defaultProps} onTaskClick={onTaskClick} tasks={[task]} />);

    fireEvent.click(screen.getByTitle('View task'));
    expect(onTaskClick).toHaveBeenCalledWith(task);
  });

  it('shows view button for assigned SAR task (non-compliance role)', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', name: 'SAR/STR Filing', assignee: 'comp-1', candidateGroup: 'compliance' })]}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  // ── Action: Update Status ──

  it('shows update status button when user is assigned and onUpdateStatus provided', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onUpdateStatus={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', assignee: 'current-user' })]}
      />,
    );
    expect(screen.getByTitle('Update status')).toBeInTheDocument();
  });

  it('calls onUpdateStatus when clicked', () => {
    const onUpdateStatus = vi.fn();
    const task = createTask({ status: 'ASSIGNED', assignee: 'current-user' });
    render(<CaseDetailTaskLogTable {...defaultProps} onUpdateStatus={onUpdateStatus} tasks={[task]} />);

    fireEvent.click(screen.getByTitle('Update status'));
    expect(onUpdateStatus).toHaveBeenCalledWith(task);
  });

  it('does not show update status for Complete New Case task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onUpdateStatus={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', assignee: 'current-user', name: 'Complete New Case' })]}
      />,
    );
    expect(screen.queryByTitle('Update status')).not.toBeInTheDocument();
  });

  it('does not show update status for SUSPENDED task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onUpdateStatus={vi.fn()}
        tasks={[createTask({ status: 'SUSPENDED', assignee: 'current-user' })]}
      />,
    );
    expect(screen.queryByTitle('Update status')).not.toBeInTheDocument();
  });

  it('does not show update status when user is not assigned', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onUpdateStatus={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', assignee: 'other-user' })]}
      />,
    );
    expect(screen.queryByTitle('Update status')).not.toBeInTheDocument();
  });

  // ── COMPLETED tasks ──

  it('shows view for completed SAR task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'COMPLETED', name: 'SAR/STR Filing' })]}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  it('shows view for completed investigate task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'COMPLETED', name: 'Investigate Case' })]}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  it('shows no actions for completed non-investigation task', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        onAssign={vi.fn()}
        onReassign={vi.fn()}
        onUnassign={vi.fn()}
        tasks={[createTask({ status: 'COMPLETED', name: 'Approve Case Closure' })]}
      />,
    );
    expect(getActionButton(container, 'View task')).toBeNull();
    expect(getActionButton(container, 'Assign task')).toBeNull();
  });

  // ── SUSPENDED tasks ──

  it('shows only view for suspended task on suspended case', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        onAssign={vi.fn()}
        caseData={{ status: 'STATUS_21_SUSPENDED' } as any}
        tasks={[createTask({ status: 'SUSPENDED', assignee: undefined })]}
      />,
    );
    expect(getActionButton(container, 'View task')).toBeInTheDocument();
    expect(getActionButton(container, 'Assign task')).toBeNull();
  });

  // ── IN_PROGRESS tasks ──

  it('shows reassign, unassign, view for in-progress investigation task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onReassign={vi.fn()}
        onUnassign={vi.fn()}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Investigate Case', assignee: 'inv-1' })]}
      />,
    );
    expect(screen.getByTitle('Reassign task')).toBeInTheDocument();
    expect(screen.getByTitle('Unassign task')).toBeInTheDocument();
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  // ── SAR/STR Filing for non-compliance ──

  it('shows no actions for unassigned SAR task when not compliance officer', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onAssign={vi.fn()}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'UNASSIGNED', name: 'SAR/STR Filing', assignee: undefined, candidateGroup: 'compliance' })]}
      />,
    );
    expect(getActionButton(container, 'Assign task')).toBeNull();
  });

  it('shows view for assigned SAR task when not compliance officer', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', name: 'SAR/STR Filing', assignee: 'comp-1', candidateGroup: 'compliance' })]}
      />,
    );
    expect(screen.getByTitle('View task')).toBeInTheDocument();
  });

  // ── Approval actions (task name div also has title=task.name, so use button selector) ──

  it('shows approve and reject buttons for Approve Case Creation', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        canManageSupervisorActions
        onApproveCaseCreation={vi.fn()}
        onRejectCaseCreation={vi.fn()}
        caseData={{ case_id: 123, status: 'STATUS_10_PENDING' } as any}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Approve Case Creation', assignee: 'sup-1' })]}
      />,
    );

    expect(getActionButton(container, 'Approve Case Creation')).toBeInTheDocument();
    expect(getActionButton(container, 'Reject Case Creation')).toBeInTheDocument();
  });

  it('calls onApproveCaseCreation with caseData', () => {
    const onApproveCaseCreation = vi.fn();
    const caseData = { case_id: 123, status: 'STATUS_10_PENDING' } as any;

    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        canManageSupervisorActions
        onApproveCaseCreation={onApproveCaseCreation}
        caseData={caseData}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Approve Case Creation', assignee: 'sup-1' })]}
      />,
    );

    fireEvent.click(getActionButton(container, 'Approve Case Creation')!);
    expect(onApproveCaseCreation).toHaveBeenCalledWith(caseData);
  });

  it('calls onRejectCaseCreation with caseData', () => {
    const onRejectCaseCreation = vi.fn();
    const caseData = { case_id: 123, status: 'STATUS_10_PENDING' } as any;

    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        canManageSupervisorActions
        onApproveCaseCreation={vi.fn()}
        onRejectCaseCreation={onRejectCaseCreation}
        caseData={caseData}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Approve Case Creation', assignee: 'sup-1' })]}
      />,
    );

    fireEvent.click(getActionButton(container, 'Reject Case Creation')!);
    expect(onRejectCaseCreation).toHaveBeenCalledWith(caseData);
  });

  it('shows review button for Approve Case Closure', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        canManageSupervisorActions
        onApproveCase={vi.fn()}
        caseData={{ case_id: 123, status: 'STATUS_20_IN_PROGRESS' } as any}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Approve Case Closure', assignee: 'sup-1' })]}
      />,
    );

    expect(getActionButton(container, 'Review Case Closure')).toBeInTheDocument();
  });

  it('calls onApproveCase when review closure button clicked', () => {
    const onApproveCase = vi.fn();
    const caseData = { case_id: 123, status: 'STATUS_20_IN_PROGRESS' } as any;

    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        canManageSupervisorActions
        onApproveCase={onApproveCase}
        caseData={caseData}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Approve Case Closure', assignee: 'sup-1' })]}
      />,
    );

    fireEvent.click(getActionButton(container, 'Review Case Closure')!);
    expect(onApproveCase).toHaveBeenCalledWith(caseData);
  });

  it('does not show approval actions without canManageSupervisorActions', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        canManageSupervisorActions={false}
        onApproveCaseCreation={vi.fn()}
        caseData={{ case_id: 123, status: 'STATUS_10_PENDING' } as any}
        tasks={[createTask({ status: 'IN_PROGRESS', name: 'Approve Case Creation', assignee: 'sup-1' })]}
      />,
    );
    expect(getActionButton(container, 'Approve Case Creation')).toBeNull();
  });

  // ── Complete New Case ──

  it('shows no actions for Complete New Case task', () => {
    const { container } = render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        onAssign={vi.fn()}
        onTaskClick={vi.fn()}
        tasks={[createTask({ status: 'ASSIGNED', name: 'Complete New Case', assignee: 'current-user' })]}
      />,
    );
    expect(getActionButton(container, 'Assign task')).toBeNull();
    expect(getActionButton(container, 'View task')).toBeNull();
  });

  // ── Multiple tasks rendering ──

  it('renders multiple task rows', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[
          createTask({ id: 1, taskId: 100, name: 'Investigate Case' }),
          createTask({ id: 2, taskId: 200, name: 'Approve Case Closure' }),
        ]}
      />,
    );
    expect(screen.getByText(/TASK-.*100/s)).toBeInTheDocument();
    expect(screen.getByText(/TASK-.*200/s)).toBeInTheDocument();
  });

  // ── Approve Case Reopening excluded from assign ──

  it('does not show assign button for Approve Case Reopening task', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ status: 'UNASSIGNED', assignee: undefined, name: 'Approve Case Reopening' })]}
      />,
    );
    expect(screen.queryByTitle('Assign task')).not.toBeInTheDocument();
  });

  // ── createdAt fallback ──

  it('uses createdAt when created is undefined', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ created: undefined, createdAt: '2024-02-20' })]}
      />,
    );
    expect(screen.getByText('2024-02-20')).toBeInTheDocument();
  });

  // ── N/A when both dates missing ──

  it('renders N/A for missing dates', () => {
    render(
      <CaseDetailTaskLogTable
        {...defaultProps}
        tasks={[createTask({ created: undefined, createdAt: undefined })]}
      />,
    );
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
