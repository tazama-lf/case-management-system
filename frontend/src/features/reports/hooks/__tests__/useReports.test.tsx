import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useReports,
  useCaseStatusStats,
  useInvestigatorWorkload,
  useTaskCompletion,
  useAuditLogs,
  useCaseAgeing,
  useEvidenceFindings,
} from '../useReports';
import { reportsService } from '../../services/reportsService';

// Mock reportsService
vi.mock('../../services/reportsService', () => ({
  reportsService: {
    getReportsData: vi.fn(),
    getInvestigatorWorkloadData: vi.fn(),
    getTaskCompletionData: vi.fn(),
    getCaseAgeingData: vi.fn(),
    getEvidenceFindingsData: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches reports data successfully', async () => {
    const mockData = {
      stats: {
        totalCases: 100,
        closedCases: 60,
        openCases: 40,
        avgResolutionTime: 12.5,
      },
      statusDistribution: {
        assigned: 10,
        inProgress: 15,
        draft: 5,
        suspended: 2,
        pendingApproval: 8,
        closed: 60,
      },
      caseTypes: [],
      outcomes: {
        resolved: 50,
        confirmed: 10,
        inconclusive: 0,
        pending: 0,
      },
      monthlyTrend: [],
      statusDetails: [],
    };

    vi.mocked(reportsService.getReportsData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useReports(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(reportsService.getReportsData).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });

  it('fetches reports data with dateRange and filters', async () => {
    const mockData = {
      stats: {
        totalCases: 0,
        closedCases: 0,
        openCases: 0,
        avgResolutionTime: 0,
      },
      statusDistribution: {
        assigned: 0,
        inProgress: 0,
        draft: 0,
        suspended: 0,
        pendingApproval: 0,
        closed: 0,
      },
      caseTypes: [],
      outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
      monthlyTrend: [],
      statusDetails: [],
    };

    vi.mocked(reportsService.getReportsData).mockResolvedValue(mockData);

    const filters = {
      caseType: 'FRAUD',
      priority: 'HIGH',
      investigator: 'user-1',
    };
    const { result } = renderHook(() => useReports('last30', filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(reportsService.getReportsData).toHaveBeenCalledWith(
      'last30',
      filters,
    );
  });

  it('handles error when fetching reports', async () => {
    vi.mocked(reportsService.getReportsData).mockRejectedValue(
      new Error('Failed to fetch'),
    );

    const { result } = renderHook(() => useReports(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useCaseStatusStats', () => {
  it('fetches case status stats', async () => {
    const mockData = {
      stats: {
        totalCases: 100,
        closedCases: 60,
        openCases: 40,
        avgResolutionTime: 12.5,
      },
      statusDistribution: {
        assigned: 0,
        inProgress: 0,
        draft: 0,
        suspended: 0,
        pendingApproval: 0,
        closed: 0,
      },
      caseTypes: [],
      outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
      monthlyTrend: [],
      statusDetails: [],
    };

    vi.mocked(reportsService.getReportsData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCaseStatusStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
  });
});

describe('useInvestigatorWorkload', () => {
  it('fetches investigator workload data', async () => {
    const mockData = {
      stats: {
        totalInvestigators: 10,
        avgCasesPerInvestigator: 15,
        avgResolutionTime: 12,
        caseClosureRate: 85,
      },
      workloadData: [],
      volumeTrend: [],
      efficiencyData: [],
      outcomeData: [],
      performanceData: [],
    };

    vi.mocked(reportsService.getInvestigatorWorkloadData).mockResolvedValue(
      mockData,
    );

    const { result } = renderHook(() => useInvestigatorWorkload('last30'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(reportsService.getInvestigatorWorkloadData).toHaveBeenCalledWith(
      'last30',
    );
  });
});

describe('useTaskCompletion', () => {
  it('fetches task completion data', async () => {
    const mockData = {
      completionRate: 85,
      avgCompletionTime: 5,
      trend: [],
      byType: [],
    };

    vi.mocked(reportsService.getTaskCompletionData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useTaskCompletion('last30'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(reportsService.getTaskCompletionData).toHaveBeenCalledWith('last30');
  });
});

describe('useCaseAgeing', () => {
  it('fetches case ageing data', async () => {
    const mockData = {
      avgCaseAge: 13,
      avgResolutionTime: 15,
      casesOver15Days: 25,
      casesOver30Days: 10,
      ageingData: [],
    };

    vi.mocked(reportsService.getCaseAgeingData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCaseAgeing('last30'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(reportsService.getCaseAgeingData).toHaveBeenCalledWith('last30');
  });
});

describe('useEvidenceFindings', () => {
  it('fetches evidence findings data', async () => {
    const mockData = {
      totalFindings: 100,
      evidenceItems: 50,
      confirmedFindings: 30,
      findings: [],
      evidenceItemsList: [],
    };

    vi.mocked(reportsService.getEvidenceFindingsData).mockResolvedValue(
      mockData,
    );

    const { result } = renderHook(() => useEvidenceFindings('last30'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(reportsService.getEvidenceFindingsData).toHaveBeenCalledWith(
      'last30',
    );
  });
});
