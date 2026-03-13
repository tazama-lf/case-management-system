import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Reports from '../CaseStatusReport';
import { useReports } from '../../hooks/useReports';
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
  useReports: vi.fn(),
}));

vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../../../shared/components/ui', () => ({
  PageContainer: ({ children, title, subtitle }: any) => (
    <div data-testid="page-container">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

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
      <span data-testid="filter-report-type">{reportType}</span>
      <span data-testid="filter-date-range">{dateRange}</span>
      <button
        data-testid="change-to-audit-logs"
        onClick={() => onChangeReportType('AUDIT_LOGS')}
      >
        Switch Audit Logs
      </button>
      <button
        data-testid="change-to-case-ageing"
        onClick={() => onChangeReportType('CASE_AGEING')}
      >
        Case Ageing
      </button>
      <button
        data-testid="change-to-investigator"
        onClick={() => onChangeReportType('INVESTIGATOR_WORKLOAD')}
      >
        Investigator
      </button>
      <button
        data-testid="change-to-evidence"
        onClick={() => onChangeReportType('EVIDENCE_FINDINGS')}
      >
        Evidence
      </button>
      <button
        data-testid="change-date-range"
        onClick={() => onChangeDateRange('last7')}
      >
        Last 7
      </button>
      <button
        data-testid="apply-filters"
        onClick={() =>
          onApplyFilters({ caseType: 'FRAUD', priority: 'HIGH', investigator: '' })
        }
      >
        Apply
      </button>
    </div>
  ),
}));

vi.mock('../../components/ReportsTable', () => ({
  default: ({ data, title, onExportExcel, onExportCSV, onExportPDF }: any) => (
    <div data-testid="reports-table">
      <span data-testid="table-title">{title}</span>
      <div data-testid="table-data">{JSON.stringify(data)}</div>
      <button onClick={onExportExcel} data-testid="export-excel">Excel</button>
      <button onClick={onExportCSV} data-testid="export-csv">CSV</button>
      <button onClick={onExportPDF} data-testid="export-pdf">PDF</button>
    </div>
  ),
}));

vi.mock('../../components/PieChart', () => ({
  default: ({ data, title }: any) => <div data-testid="pie-chart">{title}</div>,
}));

vi.mock('../../components/BarChart', () => ({
  default: ({ data, title }: any) => <div data-testid="bar-chart">{title}</div>,
}));

vi.mock('../../components/MultiBarChart', () => ({
  default: ({ data, title }: any) => <div data-testid="multi-bar-chart">{title}</div>,
}));

// Lazy-loaded sub-reports
vi.mock('../InvestigatorWorkloadReport', () => ({
  default: () => <div data-testid="investigator-workload-report">InvestigatorWorkload</div>,
}));

vi.mock('../AuditLogsReport', () => ({
  default: () => <div data-testid="audit-logs-report">AuditLogs</div>,
}));

vi.mock('../CaseAgeingReport', () => ({
  default: () => <div data-testid="case-ageing-report">CaseAgeing</div>,
}));

vi.mock('../EvidenceFindingsReport', () => ({
  default: () => <div data-testid="evidence-findings-report">EvidenceFindings</div>,
}));

vi.mock('../../../../shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data) => data),
  getColumnsForReport: vi.fn(() => []),
}));

vi.mock('../../../../shared/utils/colors', () => ({
  getCaseTypeColor: vi.fn(() => '#3b82f6'),
}));

// ─── Setup ──────────────────────────────────────────────────────

const mockShowError = vi.fn();

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const mockReportsData = {
  stats: { totalCases: 100, closedCases: 60, openCases: 40, avgResolutionTime: 12.5 },
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
  outcomes: { resolved: 50, confirmed: 10, inconclusive: 0, pending: 0 },
  monthlyTrend: [
    { month: '2024-01', casesCreated: 10, casesClosed: 8 },
    { month: '2024-02', casesCreated: 15, casesClosed: 12 },
  ],
  statusDetails: [
    { status: 'Assigned', count: 10, percentage: '25%', avgTimeInStatus: '5 days', currentTrendPeriod: '+2' },
  ],
};

describe('CaseStatusReport (Reports)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      showError: mockShowError,
    });

    vi.mocked(useReports).mockReturnValue({
      data: mockReportsData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  // ─── Default CASE_STATUS rendering ────────────────────────────

  it('renders CASE_STATUS report with stats, charts, and table', async () => {
    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('report-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('reports-table')).toBeInTheDocument();
    });
  });

  it('renders pie charts, bar chart, and multi-bar chart', async () => {
    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      const pieCharts = screen.getAllByTestId('pie-chart');
      expect(pieCharts).toHaveLength(2);
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('multi-bar-chart')).toBeInTheDocument();
    });
  });

  it('shows page title "Case Status Report" by default', () => {
    render(<Reports />, { wrapper: createWrapper() });

    expect(screen.getByText('Case Status Report')).toBeInTheDocument();
  });

  it('shows ReportFilters with CASE_STATUS and last30', () => {
    render(<Reports />, { wrapper: createWrapper() });

    expect(screen.getByTestId('filter-report-type')).toHaveTextContent('CASE_STATUS');
    expect(screen.getByTestId('filter-date-range')).toHaveTextContent('last30');
  });

  // ─── Loading ──────────────────────────────────────────────────

  it('renders loading skeleton when isLoading', () => {
    vi.mocked(useReports).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<Reports />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('report-stats-cards')).not.toBeInTheDocument();
  });

  // ─── Error ────────────────────────────────────────────────────

  it('renders error message when error occurs', () => {
    vi.mocked(useReports).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<Reports />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load reports data/i)).toBeInTheDocument();
  });

  // ─── Missing data fallback ────────────────────────────────────

  it('uses defaults when data is undefined', async () => {
    vi.mocked(useReports).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('report-stats-cards')).toHaveTextContent('"totalCases":0');
    });
  });

  // ─── Report type switching ────────────────────────────────────

  it('switches to AUDIT_LOGS report', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-audit-logs'));

    await waitFor(() => {
      expect(screen.getByTestId('audit-logs-report')).toBeInTheDocument();
    });
  });

  it('switches to CASE_AGEING report', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-case-ageing'));

    await waitFor(() => {
      expect(screen.getByTestId('case-ageing-report')).toBeInTheDocument();
    });
  });

  it('switches to INVESTIGATOR_WORKLOAD report', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-investigator'));

    await waitFor(() => {
      expect(screen.getByTestId('investigator-workload-report')).toBeInTheDocument();
    });
  });

  it('switches to EVIDENCE_FINDINGS report', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-evidence'));

    await waitFor(() => {
      expect(screen.getByTestId('evidence-findings-report')).toBeInTheDocument();
    });
  });

  // ─── Date range change ────────────────────────────────────────

  it('changes date range via filter', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-date-range'));

    expect(screen.getByTestId('filter-date-range')).toHaveTextContent('last7');
  });

  // ─── Apply filters ────────────────────────────────────────────

  it('applies filters', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('apply-filters'));

    // useReports should be called with updated filters
    expect(useReports).toHaveBeenCalled();
  });

  // ─── getPageTitle / getPageSubtitle ───────────────────────────

  it('shows correct title for AUDIT_LOGS', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-audit-logs'));

    // The PageContainer title is set by getPageTitle which returns 'Audit Logs'
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Audit Logs');
    });
  });

  it('shows correct title for INVESTIGATOR_WORKLOAD', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-investigator'));

    expect(screen.getByText('Investigator Workload Report')).toBeInTheDocument();
  });

  it('shows correct title for EVIDENCE_FINDINGS', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-evidence'));

    expect(screen.getByText('Evidence Findings Report')).toBeInTheDocument();
  });

  it('shows correct title for CASE_AGEING', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('change-to-case-ageing'));

    expect(screen.getByText('Case Ageing Report')).toBeInTheDocument();
  });

  // ─── Export Excel ─────────────────────────────────────────────

  it('exports CASE_STATUS data to Excel', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-excel'));

    expect(formatDataForExport).toHaveBeenCalledWith(
      mockReportsData.statusDetails,
      'CASE_STATUS',
    );
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('shows error via showError when Excel export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => { throw new Error('fail'); });

    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-excel'));

    expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  // ─── Export CSV ───────────────────────────────────────────────

  it('exports CASE_STATUS data to CSV', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-csv'));

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('shows error via showError when CSV export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToCSV).mockImplementation(() => { throw new Error('fail'); });

    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-csv'));

    expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  // ─── Export PDF ───────────────────────────────────────────────

  it('exports CASE_STATUS data to PDF', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-pdf'));

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalled();
      expect(getColumnsForReport).toHaveBeenCalledWith('CASE_STATUS');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('shows error via showError when PDF export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToPDF).mockRejectedValue(new Error('pdf fail'));

    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-pdf'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
    });
  });

  // ─── Outcome data with totalOutcomes = 0 ──────────────────────

  it('handles zero totalOutcomes (all zeros)', async () => {
    vi.mocked(useReports).mockReturnValue({
      data: {
        ...mockReportsData,
        outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
      },
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<Reports />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('report-stats-cards')).toBeInTheDocument();
    });
  });

  // ─── getCurrentReportData for non-CASE_STATUS returns [] ──────

  it('getCurrentReportData returns [] for AUDIT_LOGS report type on export', async () => {
    const user = userEvent.setup();
    render(<Reports />, { wrapper: createWrapper() });

    // Switch to AUDIT_LOGS — the CASE_STATUS table is hidden
    await user.click(screen.getByTestId('change-to-audit-logs'));

    await waitFor(() => {
      expect(screen.getByTestId('audit-logs-report')).toBeInTheDocument();
    });

    // The ReportsTable is not rendered for AUDIT_LOGS, but exports from the parent
    // are still bound. We can't click them since table isn't rendered.
    // This is just to validate the switch hides CASE_STATUS contents
    expect(screen.queryByTestId('reports-table')).not.toBeInTheDocument();
  });
});
