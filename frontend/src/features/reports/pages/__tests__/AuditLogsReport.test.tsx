import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuditLogsReport from '../AuditLogsReport';
import { useAuditLogs } from '../../hooks/useReports';
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
  useAuditLogs: vi.fn(),
}));

vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../components/AuditLogsStatsCards', () => ({
  default: ({ stats }: any) => (
    <div data-testid="audit-logs-stats-cards">{JSON.stringify(stats)}</div>
  ),
}));

vi.mock('../../components/AuditLogsTable', () => ({
  default: ({ data, onExportExcel, onExportCSV, onExportPDF, isLoading }: any) => (
    <div data-testid="audit-logs-table">
      <div data-testid="table-data">{JSON.stringify(data)}</div>
      <span data-testid="table-loading">{String(isLoading)}</span>
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

const mockAuditData = {
  stats: { totalLogs: 1000, caseActions: 500, userSessions: 300, systemWarnings: 10 },
  auditLogs: [
    {
      audit_log_id: 'LOG-1',
      user_id: 'user-1',
      operation: 'CREATE',
      entity_name: 'Case',
      action_performed: 'Case created',
      outcome: 'Success',
      performed_at: '2024-01-01T10:00:00Z',
      type: 'Info' as const,
    },
    {
      audit_log_id: 'LOG-2',
      user_id: 'user-2',
      operation: 'UPDATE',
      entity_name: 'Case',
      action_performed: 'Case updated',
      outcome: 'Success',
      performed_at: '2024-01-02T10:00:00Z',
      type: 'Success' as const,
    },
  ],
};

describe('AuditLogsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      showError: mockShowError,
    });

    vi.mocked(useAuditLogs).mockReturnValue({
      data: mockAuditData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  // ─── Rendering ────────────────────────────────────────────────

  it('renders stats cards and table with data', async () => {
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('audit-logs-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('audit-logs-table')).toBeInTheDocument();
    });
  });

  it('passes stats to AuditLogsStatsCards', () => {
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('audit-logs-stats-cards')).toHaveTextContent('"totalLogs":1000');
  });

  it('passes auditLogs to AuditLogsTable', () => {
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    const tableData = screen.getByTestId('table-data');
    expect(tableData).toHaveTextContent('LOG-1');
    expect(tableData).toHaveTextContent('LOG-2');
  });

  it('passes isLoading=false to AuditLogsTable when loaded', () => {
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('table-loading')).toHaveTextContent('false');
  });

  it('passes correct dateRange to useAuditLogs', () => {
    render(<AuditLogsReport dateRange="last7" />, { wrapper: createWrapper() });

    expect(useAuditLogs).toHaveBeenCalledWith('last7');
  });

  // ─── Loading ──────────────────────────────────────────────────

  it('renders loading skeleton when isLoading', () => {
    vi.mocked(useAuditLogs).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-logs-stats-cards')).not.toBeInTheDocument();
  });

  // ─── Error ────────────────────────────────────────────────────

  it('renders error message when error occurs', () => {
    vi.mocked(useAuditLogs).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      isError: true,
    } as any);

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load audit logs data/i)).toBeInTheDocument();
  });

  // ─── Missing data fallback ────────────────────────────────────

  it('uses default stats and empty auditLogs when data is undefined', () => {
    vi.mocked(useAuditLogs).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('audit-logs-stats-cards')).toHaveTextContent('"totalLogs":0');
    expect(screen.getByTestId('table-data')).toHaveTextContent('[]');
  });

  // ─── Export Excel ─────────────────────────────────────────────

  it('exports to Excel successfully', async () => {
    const user = userEvent.setup();
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('export-excel'));

    expect(formatDataForExport).toHaveBeenCalledWith(mockAuditData.auditLogs, 'AUDIT_LOGS');
    expect(exportToExcel).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('audit-logs-report-'),
      'Audit Logs Report',
    );
  });

  it('shows error via showError when Excel export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => { throw new Error('fail'); });

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByTestId('export-excel'));

    expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  // ─── Export CSV ───────────────────────────────────────────────

  it('exports to CSV successfully', async () => {
    const user = userEvent.setup();
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('export-csv'));

    expect(formatDataForExport).toHaveBeenCalledWith(mockAuditData.auditLogs, 'AUDIT_LOGS');
    expect(exportToCSV).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('audit-logs-report-'),
    );
  });

  it('shows error via showError when CSV export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToCSV).mockImplementation(() => { throw new Error('fail'); });

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByTestId('export-csv'));

    expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  // ─── Export PDF ───────────────────────────────────────────────

  it('exports to PDF successfully', async () => {
    const user = userEvent.setup();
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('export-pdf'));

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalledWith(mockAuditData.auditLogs, 'AUDIT_LOGS');
      expect(getColumnsForReport).toHaveBeenCalledWith('AUDIT_LOGS');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('shows error via showError when PDF export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToPDF).mockRejectedValue(new Error('pdf fail'));

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByTestId('export-pdf'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Export failed. Please try again.');
    });
  });
});
