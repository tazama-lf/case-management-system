import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvestigatorWorkloadReport from '../InvestigatorWorkloadReport';
import { useInvestigatorWorkload } from '../../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../../shared/utils/exportUtils';
import { useNotifications } from '@/shared/providers/NotificationProvider';

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock('../../hooks/useReports', () => ({
  useInvestigatorWorkload: vi.fn(),
}));

vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(),
}));

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
      <button onClick={onExportExcel} data-testid="export-excel">Export Excel</button>
      <button onClick={onExportCSV} data-testid="export-csv">Export CSV</button>
      <button onClick={onExportPDF} data-testid="export-pdf">Export PDF</button>
    </div>
  ),
}));

vi.mock('../../../../shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data) => data),
  getColumnsForReport: vi.fn(() => []),
}));

// ─── Setup ──────────────────────────────────────────────────────

const mockShowError = vi.fn();

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const mockWorkloadData = {
  stats: {
    totalInvestigators: 10,
    avgCasesPerInvestigator: 15,
    avgResolutionTime: 12,
    caseClosureRate: 85,
  },
  workloadData: [{ name: 'Investigator 1', activeCases: 10, pendingTasks: 5 }],
  volumeTrend: [{ month: '2024-01', investigators: { 'user-1': 10 } }],
  efficiencyData: [{ name: 'Type A', avgDays: 12 }],
  outcomeData: [{ name: 'Type A', confirmed: 10, refuted: 5, inconclusive: 3 }],
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

describe('InvestigatorWorkloadReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      showError: mockShowError,
    });

    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: mockWorkloadData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  // ─── Rendering ────────────────────────────────────────────────

  it('renders all charts, stats cards, and table', async () => {
    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('investigator-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('workload-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('case-volume-trend-chart')).toBeInTheDocument();
      expect(screen.getByTestId('resolution-efficiency-chart')).toBeInTheDocument();
      expect(screen.getByTestId('outcome-distribution-chart')).toBeInTheDocument();
      expect(screen.getByTestId('investigator-performance-table')).toBeInTheDocument();
    });
  });

  it('passes stats to InvestigatorStatsCards', () => {
    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('investigator-stats-cards')).toHaveTextContent('"totalInvestigators":10');
  });

  it('passes correct titles to chart components', () => {
    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('workload-bar-chart')).toHaveTextContent('Current Workload by Investigator');
    expect(screen.getByTestId('case-volume-trend-chart')).toHaveTextContent('Case Volume Trend by Investigator');
    expect(screen.getByTestId('resolution-efficiency-chart')).toHaveTextContent('Case Resolution Efficiency (Avg. Day)');
    expect(screen.getByTestId('outcome-distribution-chart')).toHaveTextContent('Case Outcome Distribution by Investigator');
  });

  it('passes correct dateRange to useInvestigatorWorkload', () => {
    render(<InvestigatorWorkloadReport dateRange="last7" />, { wrapper: createWrapper() });

    expect(useInvestigatorWorkload).toHaveBeenCalledWith('last7');
  });

  // ─── Loading ──────────────────────────────────────────────────

  it('renders loading skeleton when isLoading', () => {
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('investigator-stats-cards')).not.toBeInTheDocument();
  });

  // ─── Error ────────────────────────────────────────────────────

  it('renders error message when error occurs', () => {
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load investigator workload data/i)).toBeInTheDocument();
  });

  // ─── Missing data fallback ────────────────────────────────────

  it('uses default data when workloadData is undefined', async () => {
    vi.mocked(useInvestigatorWorkload).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('investigator-stats-cards')).toHaveTextContent('"totalInvestigators":0');
    });
  });

  // ─── Export Excel ─────────────────────────────────────────────

  it('exports to Excel successfully', async () => {
    const user = userEvent.setup();
    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('export-excel'));

    expect(formatDataForExport).toHaveBeenCalledWith(
      mockWorkloadData.performanceData,
      'INVESTIGATOR_WORKLOAD',
    );
    expect(exportToExcel).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('investigator-workload-report-'),
      'Investigator Workload Report',
    );
  });

  it('shows error via showError when Excel export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => { throw new Error('fail'); });

    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByTestId('export-excel'));

    expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  // ─── Export CSV ───────────────────────────────────────────────

  it('exports to CSV successfully', async () => {
    const user = userEvent.setup();
    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('export-csv'));

    expect(formatDataForExport).toHaveBeenCalledWith(
      mockWorkloadData.performanceData,
      'INVESTIGATOR_WORKLOAD',
    );
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('shows error via showError when CSV export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToCSV).mockImplementation(() => { throw new Error('fail'); });

    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByTestId('export-csv'));

    expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  // ─── Export PDF ───────────────────────────────────────────────

  it('exports to PDF successfully', async () => {
    const user = userEvent.setup();
    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('export-pdf'));

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalledWith(
        mockWorkloadData.performanceData,
        'INVESTIGATOR_WORKLOAD',
      );
      expect(getColumnsForReport).toHaveBeenCalledWith('INVESTIGATOR_WORKLOAD');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('shows error via showError when PDF export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToPDF).mockRejectedValue(new Error('pdf fail'));

    render(<InvestigatorWorkloadReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByTestId('export-pdf'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
    });
  });
});
