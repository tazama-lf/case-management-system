import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseModals from '../CaseModals';
import type { CaseRow } from '../../casesTable.utils';

const mockCaseData: CaseRow = {
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
};

describe('CaseModals', () => {
  const mockHandlers = {
    handleCreate: vi.fn(),
    handleUpdate: vi.fn(),
    handleCloseCaseSubmit: vi.fn(),
    handleReopenSubmit: vi.fn(),
    handleAbandonSubmit: vi.fn(),
    handleSuspendSubmit: vi.fn(),
    handleResumeSubmit: vi.fn(),
    handleRejectSubmit: vi.fn(),
    handleApproveSubmit: vi.fn(),
    handleApproveCreationSubmit: vi.fn(),
    handleRejectCreationSubmit: vi.fn(),
    handleReturnForReviewSubmit: vi.fn(),
    handleApproveReopenSubmit: vi.fn(),
    handleRejectReopenSubmit: vi.fn(),
  };

  const mockSetters = {
    setIsCloseCaseOpen: vi.fn(),
    setIsReopenOpen: vi.fn(),
    setIsAbandonOpen: vi.fn(),
    setIsSuspendOpen: vi.fn(),
    setIsResumeOpen: vi.fn(),
    setIsRejectOpen: vi.fn(),
    setIsApproveOpen: vi.fn(),
    setIsApproveCreationOpen: vi.fn(),
    setIsRejectCreationOpen: vi.fn(),
    setIsReturnForReviewOpen: vi.fn(),
    setIsApproveReopenOpen: vi.fn(),
    setIsRejectReopenOpen: vi.fn(),
  };

  const defaultProps = {
    isCloseCaseOpen: false,
    isReopenOpen: false,
    isAbandonOpen: false,
    isSuspendOpen: false,
    isResumeOpen: false,
    isRejectOpen: false,
    isApproveOpen: false,
    isApproveCreationOpen: false,
    isRejectCreationOpen: false,
    isReturnForReviewOpen: false,
    isApproveReopenOpen: false,
    isRejectReopenOpen: false,
    selectedRow: mockCaseData,
    ...mockSetters,
    ...mockHandlers,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when all modals are closed', () => {
    render(<CaseModals {...defaultProps} />);
    // Component should render Suspense but no modal content
    expect(screen.queryByText('Close Case')).not.toBeInTheDocument();
  });

  it('renders CloseCaseModal when isCloseCaseOpen is true', async () => {
    render(<CaseModals {...defaultProps} isCloseCaseOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Complete Case Investigation/i)).toBeInTheDocument();
    });
  });

  it('renders ReopenCaseModal when isReopenOpen is true', async () => {
    render(<CaseModals {...defaultProps} isReopenOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Reopen Case/i)).toBeInTheDocument();
    });
  });

  it('renders AbandonCaseModal when isAbandonOpen is true', async () => {
    render(<CaseModals {...defaultProps} isAbandonOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Abandon Case/i })).toBeInTheDocument();
    });
  });

  it('renders SuspendCaseModal when isSuspendOpen is true', async () => {
    render(<CaseModals {...defaultProps} isSuspendOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Suspend Case/i })).toBeInTheDocument();
    });
  });

  it('renders ResumeCaseModal when isResumeOpen is true', async () => {
    render(<CaseModals {...defaultProps} isResumeOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Resume Case/i })).toBeInTheDocument();
    });
  });

  it('renders ApproveCaseCreationModal when isApproveCreationOpen is true', async () => {
    render(<CaseModals {...defaultProps} isApproveCreationOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Approve Case Creation/i })).toBeInTheDocument();
    });
  });

  it('renders RejectCaseCreationModal when isRejectCreationOpen is true', async () => {
    render(<CaseModals {...defaultProps} isRejectCreationOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Reject Case Creation/i })).toBeInTheDocument();
    });
  });

  it('renders ApproveCaseReopenModal when isApproveReopenOpen is true', async () => {
    render(<CaseModals {...defaultProps} isApproveReopenOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Approve Case Reopening/i)).toBeInTheDocument();
    });
  });

  it('renders RejectCaseReopenModal when isRejectReopenOpen is true', async () => {
    render(<CaseModals {...defaultProps} isRejectReopenOpen={true} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Reject Case Reopening/i)).toBeInTheDocument();
    });
  });
});

