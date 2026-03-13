import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseActionsPanel from '../CaseActionsPanel';
import type { CaseRow } from '../../casesTable.utils';
import { useAuth } from '@/features/auth/components/AuthContext';
import { useCaseTasks } from '../../../hooks/useCaseTasks';
import { caseService } from '../../../services/caseService';
import authService from '@/features/auth/services/authService';

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../hooks/useCaseTasks');
vi.mock('../../../services/caseService');
vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: vi.fn().mockReturnValue({ userId: 'owner-1' }),
  },
}));

const baseCaseData: CaseRow = {
  id: 1,
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

describe('CaseActionsPanel', () => {
  const mockFetchTasks = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      hasComplianceOfficerRole: () => false,
      hasSupervisorRole: () => false,
    });
    (useCaseTasks as ReturnType<typeof vi.fn>).mockReturnValue({
      tasks: [],
      fetchTasks: mockFetchTasks,
    });
    (caseService.getCaseDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      case_id: 1,
      case_owner_user_id: 'owner-1',
    });
    (authService.getUser as ReturnType<typeof vi.fn>).mockReturnValue({
      userId: 'owner-1',
    });
  });

  it('returns null for compliance officer', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      hasComplianceOfficerRole: () => true,
      hasSupervisorRole: () => false,
    });
    const { container } = render(
      <CaseActionsPanel
        caseData={baseCaseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when no actions available', () => {
    const caseData = { ...baseCaseData, status: 'STATUS_10_ASSIGNED', action: 'View' as const };
    const { container } = render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows Complete Case button when action is Complete', () => {
    const onComplete = vi.fn();
    const caseData = { ...baseCaseData, action: 'Complete' as const };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onComplete={onComplete}
      />,
    );
    const button = screen.getByText('Complete Case');
    fireEvent.click(button);
    expect(onComplete).toHaveBeenCalledWith(caseData);
  });

  it('shows Close Case button for in-progress case with completed tasks', async () => {
    const onCloseCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_20_IN_PROGRESS',
      tasks: [{ name: 'Investigate Alert', status: 'STATUS_30_COMPLETED' }],
    };
    render(
      <CaseActionsPanel
        caseData={caseData as any}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onCloseCase={onCloseCase}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Close Case')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Close Case'));
    expect(onCloseCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Close Case for FRAUD_AND_AML with all sub-cases closed', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      hasComplianceOfficerRole: () => false,
      hasSupervisorRole: () => true,
    });
    const onCloseCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      type: 'FRAUD_AND_AML',
      status: 'STATUS_20_IN_PROGRESS',
    };
    const subCases = [
      { ...baseCaseData, id: 2, status: 'STATUS_82_CLOSED_CONFIRMED' },
    ];
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={subCases}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onCloseCase={onCloseCase}
      />,
    );
    expect(screen.getByText('Close Case')).toBeInTheDocument();
  });

  it('shows Review Case Closure for pending final approval', () => {
    const onApproveCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_22_PENDING_FINAL_APPROVAL',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={true}
        onApproveCase={onApproveCase}
      />,
    );
    const button = screen.getByText('Review Case Closure');
    fireEvent.click(button);
    expect(onApproveCase).toHaveBeenCalledWith(caseData);
  });

  it('shows Approve/Reject Case Creation for pending creation approval', () => {
    const onApproveCaseCreation = vi.fn();
    const onRejectCaseCreation = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={true}
        onApproveCaseCreation={onApproveCaseCreation}
        onRejectCaseCreation={onRejectCaseCreation}
      />,
    );
    fireEvent.click(screen.getByText('Approve Case Creation'));
    expect(onApproveCaseCreation).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Reject Case Creation'));
    expect(onRejectCaseCreation).toHaveBeenCalled();
  });

  it('shows Approve/Reject Case Reopening for pending reopening approval', () => {
    const onApproveCaseReopen = vi.fn();
    const onRejectCaseReopen = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={true}
        onApproveCaseReopen={onApproveCaseReopen}
        onRejectCaseReopen={onRejectCaseReopen}
      />,
    );
    fireEvent.click(screen.getByText('Approve Case Reopening'));
    expect(onApproveCaseReopen).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Reject Case Reopening'));
    expect(onRejectCaseReopen).toHaveBeenCalled();
  });

  it('shows Reopen Case for closed non-FRAUD_AND_AML case', () => {
    const onReopenCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_81_CLOSED_REFUTED',
      type: 'FRAUD',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={onReopenCase}
      />,
    );
    fireEvent.click(screen.getByText('Reopen Case'));
    expect(onReopenCase).toHaveBeenCalled();
  });

  it('shows Reopen Case for STATUS_82_CLOSED_CONFIRMED with completed STR task', () => {
    (useCaseTasks as ReturnType<typeof vi.fn>).mockReturnValue({
      tasks: [
        { task_id: 1, name: 'SAR/STR Filing', status: 'STATUS_30_COMPLETED' },
      ],
      fetchTasks: mockFetchTasks,
    });
    const onReopenCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_82_CLOSED_CONFIRMED',
      type: 'FRAUD',
    };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={onReopenCase}
      />,
    );
    fireEvent.click(screen.getByText('Reopen Case'));
    expect(onReopenCase).toHaveBeenCalledWith(caseData);
  });

  it('does not show Reopen Case for STATUS_82 without completed STR task', () => {
    (useCaseTasks as ReturnType<typeof vi.fn>).mockReturnValue({
      tasks: [
        { task_id: 1, name: 'SAR/STR Filing', status: 'STATUS_20_IN_PROGRESS' },
      ],
      fetchTasks: mockFetchTasks,
    });
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_82_CLOSED_CONFIRMED',
      type: 'FRAUD',
    };
    const { container } = render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onReopenCase={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows Abandon Case for draft status', () => {
    const onAbandonCase = vi.fn();
    const caseData = { ...baseCaseData, status: 'STATUS_00_DRAFT' };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onAbandonCase={onAbandonCase}
      />,
    );
    fireEvent.click(screen.getByText('Abandon Case'));
    expect(onAbandonCase).toHaveBeenCalled();
  });

  it('shows Suspend Case for in-progress case with in-progress tasks', () => {
    const onSuspendCase = vi.fn();
    const caseData = {
      ...baseCaseData,
      status: 'STATUS_20_IN_PROGRESS',
      tasks: [{ name: 'Investigate Alert', status: 'STATUS_20_IN_PROGRESS' }],
    };
    render(
      <CaseActionsPanel
        caseData={caseData as any}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onSuspendCase={onSuspendCase}
      />,
    );
    fireEvent.click(screen.getByText('Suspend Case'));
    expect(onSuspendCase).toHaveBeenCalled();
  });

  it('shows Resume Case for suspended status', () => {
    const onResumeCase = vi.fn();
    const caseData = { ...baseCaseData, status: 'STATUS_21_SUSPENDED' };
    render(
      <CaseActionsPanel
        caseData={caseData}
        subCasesDetails={undefined}
        parentCaseDetails={null}
        canManageSupervisorActions={false}
        onResumeCase={onResumeCase}
      />,
    );
    fireEvent.click(screen.getByText('Resume Case'));
    expect(onResumeCase).toHaveBeenCalled();
  });
});
