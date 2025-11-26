import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCase, useUserCases, useUserWorkloadStats, canActOnCase } from '../useCase';
import { caseService } from '../../services/caseService';

vi.mock('../../services/caseService');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches case details when caseId is provided', async () => {
    const mockCase = { id: 'CASE-123', status: 'IN_PROGRESS' };
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);

    const { result } = renderHook(() => useCase('CASE-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(caseService.getCaseDetails).toHaveBeenCalledWith('CASE-123');
    expect(result.current.data).toEqual(mockCase);
  });

  it('does not fetch when caseId is undefined', () => {
    const { result } = renderHook(() => useCase(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(caseService.getCaseDetails).not.toHaveBeenCalled();
  });
});

describe('useUserCases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches user cases', async () => {
    const mockResponse = {
      cases: [],
      total: 0,
    };
    (caseService.getUserCases as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUserCases(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(caseService.getUserCases).toHaveBeenCalled();
  });
});

describe('useUserWorkloadStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches user workload stats', async () => {
    const mockStats = {
      totalCases: 10,
      activeCases: 5,
    };
    (caseService.getUserWorkloadStats as vi.Mock).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useUserWorkloadStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(caseService.getUserWorkloadStats).toHaveBeenCalled();
  });
});

describe('canActOnCase', () => {
  it('returns true for active case status', () => {
    expect(canActOnCase('STATUS_20_IN_PROGRESS')).toBe(true);
    expect(canActOnCase('STATUS_10_ASSIGNED')).toBe(true);
  });

  it('returns false for closed case statuses', () => {
    expect(canActOnCase('STATUS_82_CLOSED_CONFIRMED')).toBe(false);
    expect(canActOnCase('STATUS_81_CLOSED_REFUTED')).toBe(false);
    expect(canActOnCase('STATUS_83_CLOSED_INCONCLUSIVE')).toBe(false);
  });

  it('returns false for undefined status', () => {
    expect(canActOnCase(undefined)).toBe(false);
  });
});

