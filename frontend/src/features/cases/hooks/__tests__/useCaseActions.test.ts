import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCaseActions } from '../useCaseActions';

// Mock all the action hooks
vi.mock('../useCloseCaseActions', () => ({
  useCloseCaseActions: () => ({
    handleCloseCaseSubmit: vi.fn(),
  }),
}));

vi.mock('../useAbandonCaseActions', () => ({
  useAbandonCaseActions: () => ({
    handleAbandonSubmit: vi.fn(),
  }),
}));

vi.mock('../useSuspendCaseActions', () => ({
  useSuspendCaseActions: () => ({
    handleSuspendSubmit: vi.fn(),
  }),
}));

vi.mock('../useResumeCaseActions', () => ({
  useResumeCaseActions: () => ({
    handleResumeSubmit: vi.fn(),
  }),
}));

vi.mock('../useApproveCaseActions', () => ({
  useApproveCaseActions: () => ({
    handleApproveClosureSubmit: vi.fn(),
    handleApproveCreation: vi.fn(),
    handleApproveReopening: vi.fn(),
  }),
}));

vi.mock('../useRejectCaseActions', () => ({
  useRejectCaseActions: () => ({
    handleRejectCaseCreation: vi.fn(),
    handleRejectCase: vi.fn(),
    handleRejectReopening: vi.fn(),
  }),
}));

vi.mock('../useReturnCaseActions', () => ({
  useReturnCaseActions: () => ({
    handleReturnForReview: vi.fn(),
  }),
}));

vi.mock('../useReopenCaseActions', () => ({
  useReopenCaseActions: () => ({
    handleReopenSubmit: vi.fn(),
  }),
}));

describe('useCaseActions', () => {
  const mockRefreshCases = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all case action handlers', () => {
    const { result } = renderHook(() => useCaseActions(mockRefreshCases));

    expect(result.current.handleCloseCaseSubmit).toBeDefined();
    expect(result.current.handleAbandonSubmit).toBeDefined();
    expect(result.current.handleSuspendSubmit).toBeDefined();
    expect(result.current.handleResumeSubmit).toBeDefined();
    expect(result.current.handleReopenSubmit).toBeDefined();
    expect(result.current.handleApproveClosureSubmit).toBeDefined();
    expect(result.current.handleApproveCreation).toBeDefined();
    expect(result.current.handleApproveReopening).toBeDefined();
    expect(result.current.handleRejectCaseCreation).toBeDefined();
    expect(result.current.handleRejectCase).toBeDefined();
    expect(result.current.handleRejectReopening).toBeDefined();
    expect(result.current.handleReturnForReview).toBeDefined();
  });
});
