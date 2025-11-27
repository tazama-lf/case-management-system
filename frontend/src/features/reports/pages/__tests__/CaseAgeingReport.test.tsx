import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import CaseAgeingReport from '../CaseAgeingReport';
import { useCaseAgeing } from '../../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../../shared/utils/exportUtils';

// Mock hooks
vi.mock('../../hooks/useReports', () => ({
  useCaseAgeing: vi.fn(),
}));

// Mock components
vi.mock('../../components/CaseAgeingStatsCards', () => ({
  default: ({ stats }: any) => <div data-testid="case-ageing-stats-cards">{JSON.stringify(stats)}</div>,
}));

vi.mock('../../components/CaseAgeingBarChart', () => ({
  default: ({ data, title }: any) => <div data-testid="case-ageing-bar-chart">{title}</div>,
}));

vi.mock('../../components/ResolutionTimeTrendChart', () => ({
  default: ({ data, title }: any) => <div data-testid="resolution-time-trend-chart">{title}</div>,
}));

vi.mock('../../components/CaseAgeingPieChart', () => ({
  default: ({ data, title }: any) => <div data-testid="case-ageing-pie-chart">{title}</div>,
}));

vi.mock('../../components/CaseTypeResolutionChart', () => ({
  default: ({ data, title }: any) => <div data-testid="case-type-resolution-chart">{title}</div>,
}));

vi.mock('../../components/CaseAgeingTable', () => ({
  default: ({ data, onExportExcel, onExportCSV, onExportPDF }: any) => (
    <div data-testid="case-ageing-table">
      <div data-testid="table-data">{JSON.stringify(data)}</div>
      <button onClick={onExportExcel} data-testid="export-excel">Export Excel</button>
      <button onClick={onExportCSV} data-testid="export-csv">Export CSV</button>
      <button onClick={onExportPDF} data-testid="export-pdf">Export PDF</button>
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

describe('CaseAgeingReport', () => {
  const mockAgeingData = {
    stats: {
      avgCaseAge: 13,
      avgResolutionTime: 15,
      casesOver15Days: 25,
      casesOver30Days: 10,
    },
    ageingByStatus: [
      { status: 'Assigned', age0to7: 10, age8to15: 5, age16to30: 3, age30Plus: 2 },
    ],
    resolutionTrend: [
      { month: '2024-01', avgDays: 12 },
      { month: '2024-02', avgDays: 15 },
    ],
    ageingDistribution: [
      { ageRange: '0-7 days', count: 50, percentage: 50, color: '#3b82f6' },
    ],
    caseTypeResolution: [
      { caseType: 'FRAUD', avgDays: 10 },
    ],
    caseDetails: [
      {
        caseId: 'CASE-1',
        type: 'FRAUD',
        status: 'Assigned',
        createdDate: '2024-01-01',
        ageDays: 15,
        priority: 'High',
        investigator: 'user-1',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCaseAgeing).mockReturnValue({
      data: mockAgeingData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  it('renders case ageing report with data', async () => {
    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('case-ageing-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('case-ageing-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('resolution-time-trend-chart')).toBeInTheDocument();
      expect(screen.getByTestId('case-ageing-pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('case-type-resolution-chart')).toBeInTheDocument();
      expect(screen.getByTestId('case-ageing-table')).toBeInTheDocument();
    });
  });

  it('renders loading state', () => {
    vi.mocked(useCaseAgeing).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('case-ageing-stats-cards')).not.toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useCaseAgeing).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load case ageing data/i)).toBeInTheDocument();
  });

  it('handles export to Excel', async () => {
    const user = userEvent.setup();
    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalledWith(mockAgeingData.caseDetails, 'CASE_AGEING');
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('handles export to CSV', async () => {
    const user = userEvent.setup();
    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-csv');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalledWith(mockAgeingData.caseDetails, 'CASE_AGEING');
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('handles export to PDF', async () => {
    const user = userEvent.setup();
    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-pdf');
    await user.click(exportButton);

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalledWith(mockAgeingData.caseDetails, 'CASE_AGEING');
      expect(getColumnsForReport).toHaveBeenCalledWith('CASE_AGEING');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('Export failed');
    });

    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(global.alert).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  it('handles missing data gracefully', async () => {
    vi.mocked(useCaseAgeing).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<CaseAgeingReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('case-ageing-stats-cards')).toBeInTheDocument();
    });
  });

  it('passes correct dateRange to useCaseAgeing', () => {
    render(<CaseAgeingReport dateRange="last7" />, { wrapper: createWrapper() });

    expect(useCaseAgeing).toHaveBeenCalledWith('last7');
  });
});

