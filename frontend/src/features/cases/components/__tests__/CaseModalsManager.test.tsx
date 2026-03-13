import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseModalsManager from '../CaseModalsManager';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CaseModalState, CaseModalActions } from '../CaseModalsManager';
import type { CaseRow } from '../casesTable.utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks for providers & utilities ---
const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

let mockParams: Record<string, unknown> = {};
const mockNavigate = vi.fn();
vi.mock('@/shared/utils/routeUtils', () => ({
  useDynamicRoute: () => ({
    params: mockParams,
    navigate: mockNavigate,
  }),
}));

const mockPerformManualTriage = vi.fn();
vi.mock('@/features/alerts/hooks/useAlertsQuery', () => ({
  useAlertOperations: () => ({
    performManualTriage: mockPerformManualTriage,
    closingAlert: new Set(),
    updatingAlert: new Set(),
  }),
}));

// --- Mock services ---
const mockCreateCase = vi.fn();
const mockSaveCaseAsDraft = vi.fn();
const mockUpdateCase = vi.fn();
const mockCompleteCase = vi.fn();
const mockApproveCaseReopening = vi.fn();
const mockRejectCaseReopening = vi.fn();
vi.mock('@/features/cases/services/caseService', () => ({
  caseService: {
    createCase: (...args: unknown[]) => mockCreateCase(...args),
    SaveCaseAsDraft: (...args: unknown[]) => mockSaveCaseAsDraft(...args),
    updateCase: (...args: unknown[]) => mockUpdateCase(...args),
    completeCase: (...args: unknown[]) => mockCompleteCase(...args),
    approveCaseReopening: (...args: unknown[]) => mockApproveCaseReopening(...args),
    rejectCaseReopening: (...args: unknown[]) => mockRejectCaseReopening(...args),
  },
}));

// --- Mock lazy-loaded modals that expose their callback props ---
vi.mock('@/features/cases/components/CloseCaseModal', () => ({
  default: ({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (d: unknown) => void }) =>
    open ? (
      <div data-testid="close-case-modal">
        <button data-testid="close-case-close" onClick={onClose}>Close</button>
        <button data-testid="close-case-submit" onClick={() => onSubmit({ finalNotes: 'test' })}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/ReopenCaseModal', () => ({
  default: ({ open, onClose, onReopen }: { open: boolean; onClose: () => void; onReopen: (id: number, reason: string) => void }) =>
    open ? (
      <div data-testid="reopen-case-modal">
        <button data-testid="reopen-close" onClick={onClose}>Close</button>
        <button data-testid="reopen-submit" onClick={() => onReopen(123, 'reason')}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/AbandonCaseModal', () => ({
  default: ({ open, onClose, onAbandon }: { open: boolean; onClose: () => void; onAbandon: (id: number, reason: string) => void }) =>
    open ? (
      <div data-testid="abandon-case-modal">
        <button data-testid="abandon-close" onClick={onClose}>Close</button>
        <button data-testid="abandon-submit" onClick={() => onAbandon(123, 'reason')}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/SuspendCaseModal', () => ({
  default: ({ open, onClose, onSuspend }: { open: boolean; onClose: () => void; onSuspend: (id: number, reason: string, taskIds: number[]) => void }) =>
    open ? (
      <div data-testid="suspend-case-modal">
        <button data-testid="suspend-close" onClick={onClose}>Close</button>
        <button data-testid="suspend-submit" onClick={() => onSuspend(123, 'reason', [1, 2])}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/ResumeCaseModal', () => ({
  default: ({ open, onClose, onResume }: { open: boolean; onClose: () => void; onResume: (id: number, reason: string) => void }) =>
    open ? (
      <div data-testid="resume-case-modal">
        <button data-testid="resume-close" onClick={onClose}>Close</button>
        <button data-testid="resume-submit" onClick={() => onResume(123, 'reason')}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/ApproveCaseCreationModal', () => ({
  default: ({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (id: number) => Promise<void> }) =>
    open ? (
      <div data-testid="approve-creation-modal">
        <button data-testid="approve-creation-close" onClick={onClose}>Close</button>
        <button data-testid="approve-creation-submit" onClick={() => { void onSubmit(123); }}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/RejectCaseCreationModal', () => ({
  default: ({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (id: number, data: { reason: string }) => Promise<void> }) =>
    open ? (
      <div data-testid="reject-creation-modal">
        <button data-testid="reject-creation-close" onClick={onClose}>Close</button>
        <button data-testid="reject-creation-submit" onClick={() => { void onSubmit(123, { reason: 'bad' }); }}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/CaseClosureDecisionModal', () => ({
  default: ({
    open,
    onClose,
    onApprove,
    onReject,
  }: {
    open: boolean;
    onClose: () => void;
    onApprove: (data: { finalOutcome: string; supervisorComments: string }) => Promise<void>;
    onReject: (reason: string) => Promise<void>;
  }) =>
    open ? (
      <div data-testid="case-closure-decision-modal">
        <button data-testid="closure-decision-close" onClick={onClose}>Close</button>
        <button
          data-testid="closure-decision-approve"
          onClick={() => { void onApprove({ finalOutcome: 'STATUS_82_CLOSED_CONFIRMED', supervisorComments: 'ok' }); }}
        >
          Approve
        </button>
        <button
          data-testid="closure-decision-reject"
          onClick={() => { void onReject('not good'); }}
        >
          Reject
        </button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/ApproveCaseReopenModal', () => ({
  default: ({
    open,
    onClose,
    onApprove,
  }: {
    open: boolean;
    onClose: () => void;
    onApprove: (caseId: number, comments?: string) => Promise<void>;
  }) =>
    open ? (
      <div data-testid="approve-reopen-modal">
        <button data-testid="approve-reopen-close" onClick={onClose}>Close</button>
        <button data-testid="approve-reopen-submit" onClick={() => { void onApprove(123, 'reopen comments'); }}>Submit</button>
      </div>
    ) : null,
}));

vi.mock('@/features/cases/components/RejectCaseReopenModal', () => ({
  default: ({
    open,
    onClose,
    onReject,
  }: {
    open: boolean;
    onClose: () => void;
    onReject: (caseId: number, reason: string) => Promise<void>;
  }) =>
    open ? (
      <div data-testid="reject-reopen-modal">
        <button data-testid="reject-reopen-close" onClick={onClose}>Close</button>
        <button data-testid="reject-reopen-submit" onClick={() => { void onReject(123, 'reject reason'); }}>Submit</button>
      </div>
    ) : null,
}));

// Mock non-lazy imports (CreateCaseModal, ViewCaseModal) - these get pulled in via barrel re-exports
vi.mock('../CreateCaseModal', () => ({
  default: ({
    open,
    onClose,
    onCreate,
    onSaveDraft,
    onUpdate,
    onCompleteCase,
  }: {
    open: boolean;
    onClose: () => void;
    onCreate: (p: unknown) => void;
    onSaveDraft: (p: unknown) => void;
    onUpdate: (id: number, p: unknown) => void;
    onCompleteCase: (id: number, p: unknown) => void;
  }) =>
    open ? (
      <div data-testid="create-case-modal">
        <button data-testid="create-close" onClick={onClose}>Close</button>
        <button data-testid="create-submit" onClick={() => onCreate({ alertId: 1, priority: 'HIGH', priorityScore: 0.8, alertType: 'FRAUD' })}>Create</button>
        <button data-testid="create-submit-no-alert" onClick={() => onCreate({ priority: 'HIGH', priorityScore: 0.8, alertType: 'FRAUD' })}>CreateNoAlert</button>
        <button data-testid="create-draft" onClick={() => onSaveDraft({ priority: 'LOW', priorityScore: 0.2, alertType: 'AML' })}>SaveDraft</button>
        <button data-testid="create-update" onClick={() => onUpdate(123, { priority: 'HIGH', priorityScore: 0.5, alertType: 'FRAUD' })}>Update</button>
        <button data-testid="create-complete" onClick={() => onCompleteCase(123, { priority: 'HIGH', priorityScore: 0.5, alertType: 'FRAUD', confidence: 0.9, note: 'done', status: 'STATUS_10_ASSIGNED' })}>Complete</button>
      </div>
    ) : null,
}));

vi.mock('../ViewCaseModal', () => ({
  default: ({
    open,
    onClose,
    onCloseCase,
    onReopenCase,
    onAbandonCase,
    onSuspendCase,
    onResumeCase,
    onApproveCase,
    onApproveCaseReopen,
    onRejectCaseReopen,
    onApproveCaseCreation,
    onRejectCaseCreation,
    onComplete,
    row,
  }: {
    open: boolean;
    onClose: () => void;
    onCloseCase?: (r: CaseRow) => void;
    onReopenCase?: (r: CaseRow) => void;
    onAbandonCase?: (r: CaseRow) => void;
    onSuspendCase?: (r: CaseRow) => void;
    onResumeCase?: (r: CaseRow) => void;
    onApproveCase?: (r: CaseRow) => void;
    onApproveCaseReopen?: (r: CaseRow) => void;
    onRejectCaseReopen?: (r: CaseRow) => void;
    onApproveCaseCreation?: (r: CaseRow) => void;
    onRejectCaseCreation?: (r: CaseRow) => void;
    onComplete?: (r: CaseRow) => void;
    row: CaseRow | null;
  }) =>
    open ? (
      <div data-testid="view-case-modal">
        <button data-testid="view-close" onClick={onClose}>Close</button>
        {row && onCloseCase && <button data-testid="view-close-case" onClick={() => onCloseCase(row)}>CloseCase</button>}
        {row && onReopenCase && <button data-testid="view-reopen" onClick={() => onReopenCase(row)}>Reopen</button>}
        {row && onAbandonCase && <button data-testid="view-abandon" onClick={() => onAbandonCase(row)}>Abandon</button>}
        {row && onSuspendCase && <button data-testid="view-suspend" onClick={() => onSuspendCase(row)}>Suspend</button>}
        {row && onResumeCase && <button data-testid="view-resume" onClick={() => onResumeCase(row)}>Resume</button>}
        {row && onApproveCase && <button data-testid="view-approve" onClick={() => onApproveCase(row)}>Approve</button>}
        {row && onApproveCaseReopen && <button data-testid="view-approve-reopen" onClick={() => onApproveCaseReopen(row)}>ApproveReopen</button>}
        {row && onRejectCaseReopen && <button data-testid="view-reject-reopen" onClick={() => onRejectCaseReopen(row)}>RejectReopen</button>}
        {row && onApproveCaseCreation && <button data-testid="view-approve-creation" onClick={() => onApproveCaseCreation(row)}>ApproveCreation</button>}
        {row && onRejectCaseCreation && <button data-testid="view-reject-creation" onClick={() => onRejectCaseCreation(row)}>RejectCreation</button>}
        {row && onComplete && <button data-testid="view-complete" onClick={() => onComplete(row)}>Complete</button>}
      </div>
    ) : null,
}));

const mockGetAlertById = vi.fn().mockResolvedValue({ alert_id: 1 });
vi.mock('@/features/alerts', () => ({
  convertToTriageAlert: vi.fn((a: unknown) => a),
  ManualTriageModal: ({
    isOpen,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: unknown) => Promise<void>;
  }) =>
    isOpen ? (
      <div data-testid="manual-triage-modal">
        <button data-testid="triage-close" onClick={onClose}>Close</button>
        <button data-testid="triage-submit" onClick={() => { onSubmit({ outcome: 'confirmed' }).catch(() => {}); }}>Submit</button>
      </div>
    ) : null,
  transformBackendAlertToUI: vi.fn((a: unknown) => a),
  triageService: { getAlertById: (...args: unknown[]) => mockGetAlertById(...args) },
}));

describe('CaseModalsManager', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const sampleRow: CaseRow = {
    id: 123,
    type: 'FRAUD',
    typeColor: 'bg-red-50',
    status: 'STATUS_10_ASSIGNED',
    statusColor: 'bg-blue-50',
    typologyId: 'TYP-001',
    score: 90,
    createdOn: '01/01/2023',
    pickedOn: '-',
    action: 'View',
    assignee: 'Unassigned',
    priority: 'HIGH',
    userRole: 'none',
    totalTasks: 0,
    alertId: 456,
  };

  const closedState: CaseModalState = {
    isCreateOpen: false,
    isUpdateAlertOpen: false,
    isViewOpen: false,
    isCloseCaseOpen: false,
    isReopenOpen: false,
    isAbandonOpen: false,
    isSuspendOpen: false,
    isResumeOpen: false,
    isCaseClosureDecisionOpen: false,
    isApproveCreationOpen: false,
    isRejectCreationOpen: false,
    isApproveReopenOpen: false,
    isRejectReopenOpen: false,
    selectedRow: null,
    createModalMode: 'create',
    editingCaseId: null,
    createCaseLoading: false,
    createCaseError: '',
  };

  const mockModalActions: CaseModalActions = {
    setIsCreateOpen: vi.fn(),
    setIsUpdateAlertOpen: vi.fn(),
    setIsViewOpen: vi.fn(),
    setIsCloseCaseOpen: vi.fn(),
    setIsReopenOpen: vi.fn(),
    setIsAbandonOpen: vi.fn(),
    setIsSuspendOpen: vi.fn(),
    setIsResumeOpen: vi.fn(),
    setIsCaseClosureDecisionOpen: vi.fn(),
    setIsApproveCreationOpen: vi.fn(),
    setIsRejectCreationOpen: vi.fn(),
    setIsApproveReopenOpen: vi.fn(),
    setIsRejectReopenOpen: vi.fn(),
    setSelectedRow: vi.fn(),
    setCreateModalMode: vi.fn(),
    setEditingCaseId: vi.fn(),
    setCreateCaseLoading: vi.fn(),
    setCreateCaseError: vi.fn(),
  };

  const mockCaseActions = {
    handleCloseCaseSubmit: vi.fn().mockResolvedValue(undefined),
    handleAbandonSubmit: vi.fn().mockResolvedValue(undefined),
    handleSuspendSubmit: vi.fn().mockResolvedValue(undefined),
    handleResumeSubmit: vi.fn().mockResolvedValue(undefined),
    handleApproveClosureSubmit: vi.fn().mockResolvedValue(undefined),
    handleApproveCreation: vi.fn().mockResolvedValue(undefined),
    handleRejectCaseCreation: vi.fn().mockResolvedValue(undefined),
    handleRejectCase: vi.fn().mockResolvedValue(undefined),
    handleReopenSubmit: vi.fn().mockResolvedValue(undefined),
  };

  const mockPermissions = {
    canManageSupervisorActions: true,
    isInvestigatorOnly: false,
  };

  const mockOnRefreshCases = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
    mockCreateCase.mockResolvedValue({ case_id: 1, status: 'STATUS_02_READY_FOR_ASSIGNMENT' });
    mockSaveCaseAsDraft.mockResolvedValue({ case_id: 1, status: 'STATUS_00_DRAFT' });
    mockUpdateCase.mockResolvedValue({ case_id: 123, status: 'STATUS_02_READY_FOR_ASSIGNMENT' });
    mockCompleteCase.mockResolvedValue({ case_id: 123, status: 'STATUS_10_ASSIGNED' });
    mockApproveCaseReopening.mockResolvedValue({ case: { status: 'STATUS_10_ASSIGNED' }, investigation_task: { task_id: 1 } });
    mockRejectCaseReopening.mockResolvedValue({ case: { status: 'STATUS_82_CLOSED_CONFIRMED' }, rejection_reason: 'No' });
    mockOnRefreshCases.mockResolvedValue(undefined);
  });

  const renderWith = (stateOverrides: Partial<CaseModalState> = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <CaseModalsManager
          modalState={{ ...closedState, ...stateOverrides }}
          modalActions={mockModalActions}
          caseActions={mockCaseActions}
          onRefreshCases={mockOnRefreshCases}
          permissions={mockPermissions}
        />
      </QueryClientProvider>,
    );

  // --- Render tests ---
  it('renders nothing when all modals are closed', () => {
    renderWith();
    expect(screen.queryByTestId('create-case-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('view-case-modal')).not.toBeInTheDocument();
  });

  it('renders create case modal when isCreateOpen is true', () => {
    renderWith({ isCreateOpen: true });
    expect(screen.getByTestId('create-case-modal')).toBeInTheDocument();
  });

  it('renders view case modal when isViewOpen is true', () => {
    renderWith({ isViewOpen: true, selectedRow: sampleRow });
    expect(screen.getByTestId('view-case-modal')).toBeInTheDocument();
  });

  it('renders close case modal when isCloseCaseOpen is true', async () => {
    renderWith({ isCloseCaseOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('close-case-modal')).toBeInTheDocument();
  });

  it('renders reopen case modal when isReopenOpen is true', async () => {
    renderWith({ isReopenOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('reopen-case-modal')).toBeInTheDocument();
  });

  it('renders abandon case modal when isAbandonOpen is true', async () => {
    renderWith({ isAbandonOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('abandon-case-modal')).toBeInTheDocument();
  });

  it('renders suspend case modal when isSuspendOpen is true', async () => {
    renderWith({ isSuspendOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('suspend-case-modal')).toBeInTheDocument();
  });

  it('renders resume case modal when isResumeOpen is true', async () => {
    renderWith({ isResumeOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('resume-case-modal')).toBeInTheDocument();
  });

  it('renders approve creation modal when isApproveCreationOpen is true', async () => {
    renderWith({ isApproveCreationOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('approve-creation-modal')).toBeInTheDocument();
  });

  it('renders reject creation modal when isRejectCreationOpen is true', async () => {
    renderWith({ isRejectCreationOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('reject-creation-modal')).toBeInTheDocument();
  });

  it('renders case closure decision modal when isCaseClosureDecisionOpen is true', async () => {
    renderWith({ isCaseClosureDecisionOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('case-closure-decision-modal')).toBeInTheDocument();
  });

  it('renders approve reopen modal when isApproveReopenOpen is true', async () => {
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('approve-reopen-modal')).toBeInTheDocument();
  });

  it('renders reject reopen modal when isRejectReopenOpen is true', async () => {
    renderWith({ isRejectReopenOpen: true, selectedRow: sampleRow });
    expect(await screen.findByTestId('reject-reopen-modal')).toBeInTheDocument();
  });

  // --- Handler tests: handleCreate ---
  it('handleCreate calls caseService.createCase and shows success toast', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-submit'));

    await waitFor(() => {
      expect(mockCreateCase).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith('Case Created', expect.stringContaining('Case 1 created'));
      expect(mockModalActions.setIsCreateOpen).toHaveBeenCalledWith(false);
    });
  });

  it('handleCreate shows error toast on failure', async () => {
    mockCreateCase.mockRejectedValueOnce(new Error('Create failed'));
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-submit'));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Create Case Failed', 'Create failed');
      expect(mockModalActions.setCreateCaseError).toHaveBeenCalledWith('Create failed');
    });
  });

  // --- handleSaveDraft ---
  it('handleSaveDraft calls SaveCaseAsDraft and shows success toast', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-draft'));

    await waitFor(() => {
      expect(mockSaveCaseAsDraft).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith('Case Created', expect.stringContaining('Case 1 created'));
    });
  });

  it('handleSaveDraft shows error on failure', async () => {
    mockSaveCaseAsDraft.mockRejectedValueOnce('string error');
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-draft'));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Create Case Failed', 'Failed to create case');
    });
  });

  // --- handleUpdate ---
  it('handleUpdate calls caseService.updateCase and shows success', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true, editingCaseId: 123, createModalMode: 'edit' });

    await user.click(screen.getByTestId('create-update'));

    await waitFor(() => {
      expect(mockUpdateCase).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith('Draft Case Completed', expect.stringContaining('Case 123'));
    });
  });

  it('handleUpdate shows error on failure', async () => {
    mockUpdateCase.mockRejectedValueOnce(new Error('Update failed'));
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-update'));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Update Case Failed', 'Update failed');
    });
  });

  // --- handleCompleteCase ---
  it('handleCompleteCase calls caseService.completeCase and shows success', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-complete'));

    await waitFor(() => {
      expect(mockCompleteCase).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith('Draft Case Completed', expect.stringContaining('Case 123'));
    });
  });

  it('handleCompleteCase shows error on failure', async () => {
    mockCompleteCase.mockRejectedValueOnce('string error');
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-complete'));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Update Case Failed', 'Failed to update case');
    });
  });

  // --- handleCloseCaseSubmit ---
  it('delegates handleCloseCaseSubmit to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isCloseCaseOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('close-case-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleCloseCaseSubmit).toHaveBeenCalledWith(123, { finalNotes: 'test' });
      expect(mockModalActions.setIsCloseCaseOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleReopenSubmit ---
  it('delegates handleReopenSubmit to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleReopenSubmit).toHaveBeenCalledWith(123, 'reason');
      expect(mockModalActions.setIsReopenOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleAbandonSubmit ---
  it('delegates handleAbandonSubmit to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isAbandonOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('abandon-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleAbandonSubmit).toHaveBeenCalledWith(123, 'reason');
      expect(mockModalActions.setIsAbandonOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleSuspendSubmit ---
  it('delegates handleSuspendSubmit to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isSuspendOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('suspend-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleSuspendSubmit).toHaveBeenCalledWith(123, 'reason', [1, 2]);
      expect(mockModalActions.setIsSuspendOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleResumeSubmit ---
  it('delegates handleResumeSubmit to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isResumeOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('resume-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleResumeSubmit).toHaveBeenCalledWith(123, 'reason');
      expect(mockModalActions.setIsResumeOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleApproveCreationSubmit ---
  it('delegates handleApproveCreation to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isApproveCreationOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-creation-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleApproveCreation).toHaveBeenCalledWith(123);
      expect(mockModalActions.setIsApproveCreationOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleRejectCreationSubmit ---
  it('delegates handleRejectCaseCreation to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isRejectCreationOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reject-creation-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleRejectCaseCreation).toHaveBeenCalledWith(123, 'bad');
      expect(mockModalActions.setIsRejectCreationOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleApproveSubmit (closure decision) ---
  it('delegates handleApproveClosureSubmit to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isCaseClosureDecisionOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('closure-decision-approve');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleApproveClosureSubmit).toHaveBeenCalledWith(
        123,
        'STATUS_82_CLOSED_CONFIRMED',
        'ok',
      );
      expect(mockModalActions.setIsCaseClosureDecisionOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleRejectSubmit (closure decision) ---
  it('delegates handleRejectCase to caseActions', async () => {
    const user = userEvent.setup();
    renderWith({ isCaseClosureDecisionOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('closure-decision-reject');
    await user.click(btn);

    await waitFor(() => {
      expect(mockCaseActions.handleRejectCase).toHaveBeenCalledWith(123, 'not good');
      expect(mockModalActions.setIsCaseClosureDecisionOpen).toHaveBeenCalledWith(false);
    });
  });

  // --- handleApproveReopenSubmit ---
  it('handleApproveReopenSubmit calls approveCaseReopening and shows success', async () => {
    const user = userEvent.setup();
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockApproveCaseReopening).toHaveBeenCalledWith(123);
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Reopening Approved',
        expect.stringContaining('Case 123 reopening has been approved'),
      );
    });
  });

  it('handleApproveReopenSubmit shows error on failure', async () => {
    mockApproveCaseReopening.mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Approve Case Reopening Failed', 'fail');
    });
  });

  // --- handleRejectReopenSubmit ---
  it('handleRejectReopenSubmit calls rejectCaseReopening and shows success', async () => {
    const user = userEvent.setup();
    renderWith({ isRejectReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reject-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockRejectCaseReopening).toHaveBeenCalledWith(123, 'reject reason');
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Reopening Rejected',
        expect.stringContaining('Case 123 reopening has been rejected'),
      );
    });
  });

  it('handleRejectReopenSubmit shows error on failure', async () => {
    mockRejectCaseReopening.mockRejectedValueOnce(new Error('fail'));
    const user = userEvent.setup();
    renderWith({ isRejectReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reject-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Reject Case Reopening Failed', 'fail');
    });
  });

  // --- ViewCaseModal callback routing ---
  it('onCloseCase from ViewCaseModal sets up close case modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-close-case'));

    expect(mockModalActions.setSelectedRow).toHaveBeenCalledWith(sampleRow);
    expect(mockModalActions.setIsCloseCaseOpen).toHaveBeenCalledWith(true);
    expect(mockModalActions.setIsViewOpen).toHaveBeenCalledWith(false);
  });

  it('onReopenCase from ViewCaseModal sets up reopen modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-reopen'));

    expect(mockModalActions.setIsReopenOpen).toHaveBeenCalledWith(true);
    expect(mockModalActions.setIsViewOpen).toHaveBeenCalledWith(false);
  });

  it('onAbandonCase from ViewCaseModal sets up abandon modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-abandon'));

    expect(mockModalActions.setIsAbandonOpen).toHaveBeenCalledWith(true);
  });

  it('onSuspendCase from ViewCaseModal sets up suspend modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-suspend'));

    expect(mockModalActions.setIsSuspendOpen).toHaveBeenCalledWith(true);
  });

  it('onResumeCase from ViewCaseModal sets up resume modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-resume'));

    expect(mockModalActions.setIsResumeOpen).toHaveBeenCalledWith(true);
  });

  it('onApproveCase from ViewCaseModal sets up closure decision modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-approve'));

    expect(mockModalActions.setIsCaseClosureDecisionOpen).toHaveBeenCalledWith(true);
  });

  it('onApproveCaseReopen from ViewCaseModal sets up approve reopen modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-approve-reopen'));

    expect(mockModalActions.setIsApproveReopenOpen).toHaveBeenCalledWith(true);
  });

  it('onRejectCaseReopen from ViewCaseModal sets up reject reopen modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-reject-reopen'));

    expect(mockModalActions.setIsRejectReopenOpen).toHaveBeenCalledWith(true);
  });

  it('onApproveCaseCreation from ViewCaseModal sets up approve creation modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-approve-creation'));

    expect(mockModalActions.setIsApproveCreationOpen).toHaveBeenCalledWith(true);
  });

  it('onRejectCaseCreation from ViewCaseModal sets up reject creation modal', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-reject-creation'));

    expect(mockModalActions.setIsRejectCreationOpen).toHaveBeenCalledWith(true);
  });

  it('onComplete with non-null type opens create modal in edit mode', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-complete'));

    expect(mockModalActions.setIsCreateOpen).toHaveBeenCalledWith(true);
    expect(mockModalActions.setCreateModalMode).toHaveBeenCalledWith('edit');
    expect(mockModalActions.setEditingCaseId).toHaveBeenCalledWith(123);
    expect(mockModalActions.setIsViewOpen).toHaveBeenCalledWith(false);
  });

  it('onComplete with null type opens triage modal', async () => {
    const user = userEvent.setup();
    const triageRow: CaseRow = { ...sampleRow, type: null as unknown as string };
    renderWith({ isViewOpen: true, selectedRow: triageRow });

    await user.click(screen.getByTestId('view-complete'));

    expect(mockModalActions.setIsUpdateAlertOpen).toHaveBeenCalledWith(true);
    expect(mockModalActions.setIsViewOpen).toHaveBeenCalledWith(false);
  });

  // --- handleApproveReopenSubmit status branch coverage ---
  it('handleApproveReopenSubmit shows STATUS_02 details', async () => {
    mockApproveCaseReopening.mockResolvedValueOnce({
      case: { status: 'STATUS_02_READY_FOR_ASSIGNMENT' },
      investigation_task: { task_id: 5, candidateGroup: 'SpecialGroup' },
    });
    const user = userEvent.setup();
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Reopening Approved',
        expect.stringContaining('STATUS_02_READY_FOR_ASSIGNMENT'),
      );
    });
  });

  it('handleApproveReopenSubmit shows STATUS_31 details', async () => {
    mockApproveCaseReopening.mockResolvedValueOnce({
      case: { status: 'STATUS_31_REOPENED' },
      investigation_task: {},
    });
    const user = userEvent.setup();
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Reopening Approved',
        expect.stringContaining('STATUS_31_REOPENED'),
      );
    });
  });

  it('handleRejectReopenSubmit shows closed status details', async () => {
    mockRejectCaseReopening.mockResolvedValueOnce({
      case: { status: 'STATUS_82_CLOSED_CONFIRMED' },
      rejection_reason: 'No reopening',
    });
    const user = userEvent.setup();
    renderWith({ isRejectReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reject-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Reopening Rejected',
        expect.stringContaining('The case remains closed'),
      );
    });
  });

  // --- CreateCaseModal onClose resets state ---
  it('CreateCaseModal onClose resets create state', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-close'));

    expect(mockModalActions.setIsCreateOpen).toHaveBeenCalledWith(false);
    expect(mockModalActions.setCreateCaseError).toHaveBeenCalledWith('');
    expect(mockModalActions.setCreateModalMode).toHaveBeenCalledWith('create');
    expect(mockModalActions.setEditingCaseId).toHaveBeenCalledWith(null);
  });

  // --- handleCreate with alertId includes alert info in success message ---
  it('handleCreate includes alert info in success message when alertId provided', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-submit'));

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Created',
        expect.stringContaining('Associated Alert ID: 1'),
      );
    });
  });

  // --- closeViewCaseModal ---
  it('closeViewCaseModal closes view and resets selected row', async () => {
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-close'));

    expect(mockModalActions.setIsViewOpen).toHaveBeenCalledWith(false);
    expect(mockModalActions.setSelectedRow).toHaveBeenCalledWith(null);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('closeViewCaseModal navigates to /cases when caseId param exists', async () => {
    mockParams = { caseId: '123' };
    const user = userEvent.setup();
    renderWith({ isViewOpen: true, selectedRow: sampleRow });

    await user.click(screen.getByTestId('view-close'));

    expect(mockModalActions.setIsViewOpen).toHaveBeenCalledWith(false);
    expect(mockModalActions.setSelectedRow).toHaveBeenCalledWith(null);
    expect(mockNavigate).toHaveBeenCalledWith('/cases');
  });

  // --- handleManualTriage ---
  it('handleManualTriage calls performManualTriage and shows success', async () => {
    const user = userEvent.setup();
    mockPerformManualTriage.mockResolvedValueOnce(undefined);
    const triageRow: CaseRow = { ...sampleRow, type: null as unknown as string, alertId: 456 };

    renderWith({ isViewOpen: true, isUpdateAlertOpen: true, selectedRow: triageRow });

    await user.click(screen.getByTestId('view-complete'));
    const triageSubmit = await screen.findByTestId('triage-submit');
    await user.click(triageSubmit);

    await waitFor(() => {
      expect(mockPerformManualTriage).toHaveBeenCalledWith({
        alertId: 1,
        data: { outcome: 'confirmed' },
      });
      expect(mockSuccess).toHaveBeenCalledWith(
        'Manual Triage Completed',
        'The alert has been triaged successfully.',
      );
    });

    // Wait for the 500ms setTimeout and onRefreshCases to complete
    await waitFor(() => {
      expect(mockOnRefreshCases).toHaveBeenCalled();
    }, { timeout: 2000 });
  }, 10000);

  it('handleManualTriage shows error on failure', async () => {
    const user = userEvent.setup();
    mockPerformManualTriage.mockRejectedValueOnce(new Error('Triage failed'));
    const triageRow: CaseRow = { ...sampleRow, type: null as unknown as string, alertId: 456 };

    renderWith({ isViewOpen: true, isUpdateAlertOpen: true, selectedRow: triageRow });

    await user.click(screen.getByTestId('view-complete'));
    const triageSubmit = await screen.findByTestId('triage-submit');
    await user.click(triageSubmit);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Triage Failed', 'Triage failed');
    });
  });

  // --- ManualTriageModal onClose ---
  it('ManualTriageModal onClose clears alert and closes modal', async () => {
    const user = userEvent.setup();
    const triageRow: CaseRow = { ...sampleRow, type: null as unknown as string, alertId: 456 };

    renderWith({ isViewOpen: true, isUpdateAlertOpen: true, selectedRow: triageRow });

    await user.click(screen.getByTestId('view-complete'));
    const triageClose = await screen.findByTestId('triage-close');
    await user.click(triageClose);

    expect(mockModalActions.setIsUpdateAlertOpen).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(screen.queryByTestId('manual-triage-modal')).not.toBeInTheDocument();
    });
  });

  // --- Lazy modal onClose callbacks ---
  it('CloseCaseModal onClose sets isCloseCaseOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isCloseCaseOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('close-case-close');
    await user.click(btn);

    expect(mockModalActions.setIsCloseCaseOpen).toHaveBeenCalledWith(false);
  });

  it('ReopenCaseModal onClose sets isReopenOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reopen-close');
    await user.click(btn);

    expect(mockModalActions.setIsReopenOpen).toHaveBeenCalledWith(false);
  });

  it('AbandonCaseModal onClose sets isAbandonOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isAbandonOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('abandon-close');
    await user.click(btn);

    expect(mockModalActions.setIsAbandonOpen).toHaveBeenCalledWith(false);
  });

  it('SuspendCaseModal onClose sets isSuspendOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isSuspendOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('suspend-close');
    await user.click(btn);

    expect(mockModalActions.setIsSuspendOpen).toHaveBeenCalledWith(false);
  });

  it('ResumeCaseModal onClose sets isResumeOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isResumeOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('resume-close');
    await user.click(btn);

    expect(mockModalActions.setIsResumeOpen).toHaveBeenCalledWith(false);
  });

  it('CaseClosureDecisionModal onClose sets isCaseClosureDecisionOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isCaseClosureDecisionOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('closure-decision-close');
    await user.click(btn);

    expect(mockModalActions.setIsCaseClosureDecisionOpen).toHaveBeenCalledWith(false);
  });

  it('ApproveCaseCreationModal onClose sets isApproveCreationOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isApproveCreationOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-creation-close');
    await user.click(btn);

    expect(mockModalActions.setIsApproveCreationOpen).toHaveBeenCalledWith(false);
  });

  it('RejectCaseCreationModal onClose sets isRejectCreationOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isRejectCreationOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reject-creation-close');
    await user.click(btn);

    expect(mockModalActions.setIsRejectCreationOpen).toHaveBeenCalledWith(false);
  });

  it('ApproveCaseReopenModal onClose sets isApproveReopenOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-reopen-close');
    await user.click(btn);

    expect(mockModalActions.setIsApproveReopenOpen).toHaveBeenCalledWith(false);
  });

  it('RejectCaseReopenModal onClose sets isRejectReopenOpen to false', async () => {
    const user = userEvent.setup();
    renderWith({ isRejectReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('reject-reopen-close');
    await user.click(btn);

    expect(mockModalActions.setIsRejectReopenOpen).toHaveBeenCalledWith(false);
  });

  // --- handleCreate without alertId ---
  it('handleCreate without alertId omits alert info from success message', async () => {
    const user = userEvent.setup();
    renderWith({ isCreateOpen: true });

    await user.click(screen.getByTestId('create-submit-no-alert'));

    await waitFor(() => {
      expect(mockCreateCase).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Created',
        expect.not.stringContaining('Associated Alert ID'),
      );
    });
  });

  // --- handleApproveReopenSubmit with assigned_to ---
  it('handleApproveReopenSubmit includes assigned_to in success message', async () => {
    mockApproveCaseReopening.mockResolvedValueOnce({
      case: { status: 'STATUS_10_ASSIGNED' },
      investigation_task: { task_id: 5, assigned_to: 'analyst1' },
    });
    const user = userEvent.setup();
    renderWith({ isApproveReopenOpen: true, selectedRow: sampleRow });

    const btn = await screen.findByTestId('approve-reopen-submit');
    await user.click(btn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Case Reopening Approved',
        expect.stringContaining('assigned to analyst1'),
      );
    });
  });

  // --- openTriageModal error handling ---
  it('openTriageModal handles getAlertById failure gracefully', async () => {
    const user = userEvent.setup();
    mockGetAlertById.mockRejectedValueOnce(new Error('Alert not found'));
    const triageRow: CaseRow = { ...sampleRow, type: null as unknown as string, alertId: 456 };

    renderWith({ isViewOpen: true, isUpdateAlertOpen: true, selectedRow: triageRow });

    await user.click(screen.getByTestId('view-complete'));

    await waitFor(() => {
      expect(mockModalActions.setIsUpdateAlertOpen).toHaveBeenCalledWith(false);
    });
    // ManualTriageModal should not appear since selectedAlert is null
    expect(screen.queryByTestId('manual-triage-modal')).not.toBeInTheDocument();
  });

  // --- CreateCaseModal initial prop with FRAUD_AND_AML type ---
  it('renders create modal with selectedRow having AML type', () => {
    const amlRow: CaseRow = { ...sampleRow, type: 'AML' };
    renderWith({ isCreateOpen: true, selectedRow: amlRow });
    expect(screen.getByTestId('create-case-modal')).toBeInTheDocument();
  });

  it('renders create modal with selectedRow having FRAUD_AND_AML type', () => {
    const bothRow: CaseRow = { ...sampleRow, type: 'FRAUD_AND_AML' };
    renderWith({ isCreateOpen: true, selectedRow: bothRow });
    expect(screen.getByTestId('create-case-modal')).toBeInTheDocument();
  });
});
