import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import InvestigatorWorkloadReport from '../InvestigatorWorkloadReport';
import { useInvestigatorWorkload } from '../../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../../shared/utils/exportUtils';

// Mock hooks
vi.mock('../../hooks/useReports', () => ({
  useInvestigatorWorkload: vi.fn(),
}));

// Mock components
vi.mock('../../components/InvestigatorStatsCards', () => ({
  default: ({ stats }: any) => (
    <div data-testid="investigator-stats-cards">{JSON.stringify(stats)}</div>
  ),
}));

vi.mock('../../components/WorkloadBarChart', () => ({
  default: ({ data, title }: any) => (
    <div data-testid="workload-bar-chart">{title}</div>
  ),
}));

vi.mock('../../components/CaseVolumeTrendChart', () => ({
  default: ({ data, title }: any) => (
    <div data-testid="case-volume-trend-chart">{title}</div>
  ),
}));

vi.mock('../../components/ResolutionEfficiencyChart', () => ({
  default: ({ data, title }: any) => (
    <div data-testid="resolution-efficiency-chart">{title}</div>
  ),
}));

vi.mock('../../components/OutcomeDistributionChart', () => ({
  default: ({ data, title }: any) => (
    <div data-testid="outcome-distribution-chart">{title}</div>
  ),
}));

vi.mock('../../components/InvestigatorPerformanceTable', () => ({
  default: ({ data, onExportExcel, onExportCSV, onExportPDF }: any) => (
    <div data-testid="investigator-performance-table">
      <div data-testid="table-data">{JSON.stringify(data)}</div>
      <button onClick={onExportExcel} data-testid="export-excel">
        Export Excel
      </button>
      <button onClick={onExportCSV} data-testid="export-csv">
        Export CSV
      </button>
      <button onClick={onExportPDF} data-testid="export-pdf">
        Export PDF
      </button>
    </div>
  ),
}));

// Mock export utilities
vi.mock('../../../../shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data) => data),
  getColumnsForReport: vi.fn(() => []),
}));

// Mock window.alert
global.alert = vi.fn();

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

describe('InvestigatorWorkloadReport', () => {
  const mockWorkloadData = {
    stats: {
      totalInvestigators: 10,
      avgCasesPerInvestigator: 15,
      avgResolutionTime: 12,
      caseClosureRate: 85,
    },
    workloadData: [
      { name: 'Investigator 1', activeCases: 10, pendingTasks: 5 },
    ],
    volumeTrend: [{ month: '2024-01', investigators: { 'user-1': 10 } }],
    efficiencyData: [{ name: 'Type A', avgDays: 12 }],
    outcomeData: [
      { name: 'Type A', confirmed: 10, refuted: 5, inconclusive: 3 },
    ],
    performanceData: [
      {
        investigator: 'Investigator 1',
        investigatorId: 'user-1',
        role: 'Investigator',
        activeCases: 10,
        completedCases: 25,
        avgResolutionTime: 12,
        caseClosureRate: 85,
        performanceTrend: 'Improving',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: mockWorkloadData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  it('renders investigator workload report with data', async () => {
    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('investigator-stats-cards'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('workload-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('case-volume-trend-chart')).toBeInTheDocument();
      expect(
        screen.getByTestId('resolution-efficiency-chart'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('outcome-distribution-chart'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('investigator-performance-table'),
      ).toBeInTheDocument();
    });
  });

  it('renders loading state', () => {
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(
      screen.queryByTestId('investigator-stats-cards'),
    ).not.toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText(/Failed to load investigator workload data/i),
    ).toBeInTheDocument();
  });

  it('handles export to Excel', async () => {
    const user = userEvent.setup();
    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalledWith(
      mockWorkloadData.performanceData,
      'INVESTIGATOR_WORKLOAD',
    );
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('handles export to CSV', async () => {
    const user = userEvent.setup();
    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-csv');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalledWith(
      mockWorkloadData.performanceData,
      'INVESTIGATOR_WORKLOAD',
    );
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('handles export to PDF', async () => {
    const user = userEvent.setup();
    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-pdf');
    await user.click(exportButton);

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalledWith(
        mockWorkloadData.performanceData,
        'INVESTIGATOR_WORKLOAD',
      );
      expect(getColumnsForReport).toHaveBeenCalledWith('INVESTIGATOR_WORKLOAD');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('Export failed');
    });

    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(global.alert).toHaveBeenCalledWith(
      'Export failed. Please try again.',
    );
  });

  it('handles missing data gracefully', async () => {
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<InvestigatorWorkloadReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('investigator-stats-cards'),
      ).toBeInTheDocument();
    });
  });

  it('passes correct dateRange to useInvestigatorWorkload', () => {
    render(<InvestigatorWorkloadReport dateRange="last7" />, {
      wrapper: createWrapper(),
    });

    expect(useInvestigatorWorkload).toHaveBeenCalledWith('last7');
  });
});
