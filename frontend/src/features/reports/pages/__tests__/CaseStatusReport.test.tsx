import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CaseStatusReport from '../CaseStatusReport';
import { useReports } from '../../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../../shared/utils/exportUtils';

// Mock hooks
vi.mock('../../hooks/useReports', () => ({
  useReports: vi.fn(),
}));

// Mock components
vi.mock('../../components/ReportStatsCards', () => ({
  default: ({ stats }: any) => (
    <div data-testid="report-stats-cards">{JSON.stringify(stats)}</div>
  ),
}));

vi.mock('../../components/ReportFilters', () => ({
  default: ({
    reportType,
    dateRange,
    onChangeReportType,
    onChangeDateRange,
    onApplyFilters,
  }: any) => (
    <div data-testid="report-filters">
      <button onClick={() => onChangeReportType('AUDIT_LOGS')}>
        Change Report Type
      </button>
      <button onClick={() => onChangeDateRange('last7')}>
        Change Date Range
      </button>
      <button
        onClick={() =>
          onApplyFilters({ caseType: 'FRAUD', priority: '', investigator: '' })
        }
      >
        Apply Filters
      </button>
    </div>
  ),
}));

vi.mock('../../components/ReportsTable', () => ({
  default: ({ data, onExportExcel, onExportCSV, onExportPDF }: any) => (
    <div data-testid="reports-table">
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

// Mock lazy-loaded components
vi.mock('../../components/PieChart', () => ({
  default: ({ data, title }: any) => <div data-testid="pie-chart">{title}</div>,
}));

vi.mock('../../components/BarChart', () => ({
  default: ({ data, title }: any) => <div data-testid="bar-chart">{title}</div>,
}));

vi.mock('../../components/MultiBarChart', () => ({
  default: ({ data, title }: any) => (
    <div data-testid="multi-bar-chart">{title}</div>
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

// Mock getCaseTypeColor
vi.mock('../../../../shared/utils/colors', () => ({
  getCaseTypeColor: vi.fn(() => '#3b82f6'),
}));

// Mock PageContainer
vi.mock('../../../../shared/components/ui', () => ({
  PageContainer: ({ children, title }: any) => (
    <div data-testid="page-container">
      <h1>{title}</h1>
      {children}
    </div>
  ),
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

describe('CaseStatusReport', () => {
  const mockReportsData = {
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
    caseTypes: [
      { name: 'FRAUD', count: 50, color: '#3b82f6' },
      { name: 'MONEY_LAUNDERING', count: 30, color: '#10b981' },
    ],
    outcomes: {
      resolved: 50,
      confirmed: 10,
      inconclusive: 0,
      pending: 0,
    },
    monthlyTrend: [
      { month: '2024-01', casesCreated: 10, casesClosed: 8 },
      { month: '2024-02', casesCreated: 15, casesClosed: 12 },
    ],
    statusDetails: [
      {
        status: 'Assigned',
        count: 10,
        percentage: '25%',
        avgTimeInStatus: '5 days',
        currentTrendPeriod: '+2',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReports).mockReturnValue({
      data: mockReportsData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  it('renders case status report with data', async () => {
    render(<CaseStatusReport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('report-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('reports-table')).toBeInTheDocument();
    });
  });

  it('renders loading state', () => {
    vi.mocked(useReports).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<CaseStatusReport />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('report-stats-cards')).not.toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useReports).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<CaseStatusReport />, { wrapper: createWrapper() });

    expect(
      screen.getByText(/Failed to load reports data/i),
    ).toBeInTheDocument();
  });

  it('handles export to Excel', async () => {
    const user = userEvent.setup();
    render(<CaseStatusReport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('handles export to CSV', async () => {
    const user = userEvent.setup();
    render(<CaseStatusReport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-csv');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('handles export to PDF', async () => {
    const user = userEvent.setup();
    render(<CaseStatusReport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-pdf');
    await user.click(exportButton);

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalled();
      expect(getColumnsForReport).toHaveBeenCalled();
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('Export failed');
    });

    render(<CaseStatusReport />, { wrapper: createWrapper() });

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
    vi.mocked(useReports).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<CaseStatusReport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('report-stats-cards')).toBeInTheDocument();
    });
  });

  it('renders charts with correct data', async () => {
    render(<CaseStatusReport />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        const pieCharts = screen.getAllByTestId('pie-chart');
        expect(pieCharts.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('multi-bar-chart')).toBeInTheDocument();
  });
});
