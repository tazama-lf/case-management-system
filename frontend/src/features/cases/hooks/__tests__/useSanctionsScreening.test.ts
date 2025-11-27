import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCaseSanctionsScreenings,
  useSanctionsScreening,
} from '../useSanctionsScreening';
import * as sanctionsService from '../../services/sanctionsService';

vi.mock('../../services/sanctionsService');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useSanctionsScreening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches case sanctions screenings', async () => {
    const mockScreenings = {
      screenings: [],
      total: 0,
    };
    (sanctionsService.getCaseSanctionsScreenings as vi.Mock).mockResolvedValue(mockScreenings);

    const { result } = renderHook(() => useCaseSanctionsScreenings('CASE-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(sanctionsService.getCaseSanctionsScreenings).toHaveBeenCalledWith('CASE-123', undefined);
  });

  it('fetches single sanctions screening', async () => {
    const mockScreening = { id: 'SCREENING-1', status: 'PENDING' };
    (sanctionsService.getSanctionsScreening as vi.Mock).mockResolvedValue(mockScreening);

    const { result } = renderHook(() => useSanctionsScreening('SCREENING-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(sanctionsService.getSanctionsScreening).toHaveBeenCalledWith('SCREENING-1');
  });
});

