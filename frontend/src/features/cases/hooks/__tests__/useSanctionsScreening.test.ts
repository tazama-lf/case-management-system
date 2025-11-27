import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useCaseSanctionsScreenings,
  useSanctionsScreening,
  useCreateSanctionsScreening,
  useUpdateSanctionsScreening,
  useDeleteSanctionsScreening,
  useDownloadSanctionsReport,
  useSanctionsScreeningAuditLogs,
  useCaseSanctionsStatistics,
  useSearchSanctionsScreenings,
} from '../useSanctionsScreening';
import * as sanctionsService from '../../services/sanctionsService';

vi.mock('../../services/sanctionsService');
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

  describe('useCaseSanctionsScreenings', () => {
    it('fetches case sanctions screenings', async () => {
      const mockScreenings = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
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

    it('fetches case sanctions screenings with filters', async () => {
      const mockScreenings = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      (sanctionsService.getCaseSanctionsScreenings as vi.Mock).mockResolvedValue(mockScreenings);

      const filters = { disposition: 'PENDING_REVIEW', tool_source: 'OFAC' };
      const { result } = renderHook(() => useCaseSanctionsScreenings('CASE-123', filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(sanctionsService.getCaseSanctionsScreenings).toHaveBeenCalledWith('CASE-123', filters);
    });
  });

  describe('useSanctionsScreening', () => {
    it('fetches single sanctions screening', async () => {
      const mockScreening = { screening_id: 'SCREENING-1', status: 'PENDING' };
      (sanctionsService.getSanctionsScreening as vi.Mock).mockResolvedValue(mockScreening);

      const { result } = renderHook(() => useSanctionsScreening('SCREENING-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(sanctionsService.getSanctionsScreening).toHaveBeenCalledWith('SCREENING-1');
    });

    it('respects enabled flag', () => {
      const { result } = renderHook(() => useSanctionsScreening(''), {
        wrapper: createWrapper(),
      });

      // When screeningId is empty, the query should be disabled
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe('useCreateSanctionsScreening', () => {
    it('creates sanctions screening successfully', async () => {
      const mockResponse = {
        screening: {
          screening_id: 'SCREENING-1',
          case_id: 'CASE-123',
        },
      };
      (sanctionsService.createSanctionsScreening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCreateSanctionsScreening(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          case_id: 'CASE-123',
          screening_date: '2024-01-01',
          tool_source: 'OFAC',
          disposition: 'PENDING_REVIEW',
          summary: 'Test screening',
        });
      });

      expect(sanctionsService.createSanctionsScreening).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });

    it('handles creation error', async () => {
      const error = new Error('Creation failed');
      (sanctionsService.createSanctionsScreening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateSanctionsScreening(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            case_id: 'CASE-123',
            screening_date: '2024-01-01',
            tool_source: 'OFAC',
            disposition: 'PENDING_REVIEW',
            summary: 'Test',
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('useUpdateSanctionsScreening', () => {
    it('updates sanctions screening successfully', async () => {
      const mockResponse = {
        screening: {
          screening_id: 'SCREENING-1',
          case_id: 'CASE-123',
          disposition: 'CLEARED',
        },
      };
      (sanctionsService.updateSanctionsScreening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useUpdateSanctionsScreening(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          screening_id: 'SCREENING-1',
          disposition: 'CLEARED',
        });
      });

      expect(sanctionsService.updateSanctionsScreening).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe('useDeleteSanctionsScreening', () => {
    it('deletes sanctions screening successfully', async () => {
      const mockResponse = {
        screening_id: 'SCREENING-1',
        success: true,
      };
      (sanctionsService.deleteSanctionsScreening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDeleteSanctionsScreening(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('SCREENING-1');
      });

      expect(sanctionsService.deleteSanctionsScreening).toHaveBeenCalledWith('SCREENING-1');
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe('useDownloadSanctionsReport', () => {
    it('downloads sanctions report', async () => {
      const mockResponse = {
        url: 'http://example.com/report.pdf',
        file_name: 'report.pdf',
      };
      (sanctionsService.downloadSanctionsReport as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useDownloadSanctionsReport(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('SCREENING-1');
      });

      expect(sanctionsService.downloadSanctionsReport).toHaveBeenCalledWith('SCREENING-1');
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe('useSanctionsScreeningAuditLogs', () => {
    it('fetches audit logs', async () => {
      const mockLogs = [
        {
          log_id: 'LOG-1',
          screening_id: 'SCREENING-1',
          action: 'CREATE',
          user_id: 'user-1',
          timestamp: new Date(),
        },
      ];
      (sanctionsService.getSanctionsScreeningAuditLogs as vi.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => useSanctionsScreeningAuditLogs('SCREENING-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(sanctionsService.getSanctionsScreeningAuditLogs).toHaveBeenCalledWith('SCREENING-1');
    });
  });

  describe('useCaseSanctionsStatistics', () => {
    it('fetches case sanctions statistics', async () => {
      const mockStats = {
        total_screenings: 10,
        high_risk_count: 2,
        pending_review_count: 3,
      };
      (sanctionsService.getCaseSanctionsStatistics as vi.Mock).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useCaseSanctionsStatistics('CASE-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(sanctionsService.getCaseSanctionsStatistics).toHaveBeenCalledWith('CASE-123');
    });
  });

  describe('useSearchSanctionsScreenings', () => {
    it('searches sanctions screenings', async () => {
      const mockResponse = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      (sanctionsService.searchSanctionsScreenings as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useSearchSanctionsScreenings({ disposition: 'PENDING_REVIEW' }, 1, 20),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(sanctionsService.searchSanctionsScreenings).toHaveBeenCalled();
    });
  });
});

