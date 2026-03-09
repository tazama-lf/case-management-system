import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CaseModalsManager from '../CaseModalsManager';
import { vi, describe, it, expect } from 'vitest';
import type { CaseModalState, CaseModalActions } from '../CaseModalsManager';

// Mock hooks
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/shared/utils/routeUtils', () => ({
  useDynamicRoute: () => ({
    params: {},
    navigate: vi.fn(),
  }),
}));

// Mock the lazy loaded components to avoid suspense issues in tests
vi.mock('@/features/cases/components/CreateCaseModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-case-modal">Create Case Modal</div> : null,
}));
vi.mock('@/features/cases/components/ViewCaseModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="view-case-modal">View Case Modal</div> : null,
}));
vi.mock('@/features/cases/components/CloseCaseModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="close-case-modal">Close Case Modal</div> : null,
}));

// Mock other lazy components similarly if needed for specific tests
// For brevity, I'm mocking the ones I'll test explicitly first

describe('CaseModalsManager', () => {
  const mockModalState: CaseModalState = {
    isCreateOpen: false,
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
    handleCloseCaseSubmit: vi.fn(),
    handleAbandonSubmit: vi.fn(),
    handleSuspendSubmit: vi.fn(),
    handleResumeSubmit: vi.fn(),
    handleApproveClosureSubmit: vi.fn(),
    handleApproveCreation: vi.fn(),
    handleRejectCaseCreation: vi.fn(),
    handleRejectCase: vi.fn(),
    handleReopenSubmit: vi.fn(),
  };

  const mockOnRefreshCases = vi.fn();

  it('renders nothing when all modals are closed', () => {
    render(
      <CaseModalsManager
        modalState={mockModalState}
        modalActions={mockModalActions}
        caseActions={mockCaseActions}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(screen.queryByTestId('create-case-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('view-case-modal')).not.toBeInTheDocument();
  });

  it('renders create case modal when isCreateOpen is true', () => {
    render(
      <CaseModalsManager
        modalState={{ ...mockModalState, isCreateOpen: true }}
        modalActions={mockModalActions}
        caseActions={mockCaseActions}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(screen.getByTestId('create-case-modal')).toBeInTheDocument();
  });

  it('renders view case modal when isViewOpen is true', () => {
    render(
      <CaseModalsManager
        modalState={{ ...mockModalState, isViewOpen: true }}
        modalActions={mockModalActions}
        caseActions={mockCaseActions}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    expect(screen.getByTestId('view-case-modal')).toBeInTheDocument();
  });

  it('renders close case modal when isCloseCaseOpen is true', async () => {
    render(
      <CaseModalsManager
        modalState={{ ...mockModalState, isCloseCaseOpen: true }}
        modalActions={mockModalActions}
        caseActions={mockCaseActions}
        onRefreshCases={mockOnRefreshCases}
      />,
    );

    // Since CloseCaseModal is lazy loaded and wrapped in Suspense, we might need to wait
    // However, we mocked the default export, so it should render immediately if the mock is applied correctly.
    // If the real component was used, we'd see "Loading modal..."
    expect(await screen.findByTestId('close-case-modal')).toBeInTheDocument();
  });
});
