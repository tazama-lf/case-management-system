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

// Mock hooks
vi.mock('../../hooks/useReports', () => ({
  useAuditLogs: vi.fn(),
}));

// Mock components
vi.mock('../../components/AuditLogsStatsCards', () => ({
  default: ({ stats }: any) => <div data-testid="audit-logs-stats-cards">{JSON.stringify(stats)}</div>,
}));

vi.mock('../../components/AuditLogsTable', () => ({
  default: ({ data, onExportExcel, onExportCSV, onExportPDF }: any) => (
    <div data-testid="audit-logs-table">
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

describe('AuditLogsReport', () => {
  const mockAuditData = {
    stats: {
      totalLogs: 1000,
      caseActions: 500,
      userSessions: 300,
      systemWarnings: 10,
    },
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuditLogs).mockReturnValue({
      data: mockAuditData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  it('renders audit logs report with data', async () => {
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('audit-logs-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('audit-logs-table')).toBeInTheDocument();
    });
  });

  it('renders loading state', () => {
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

  it('renders error state', () => {
    vi.mocked(useAuditLogs).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load audit logs data/i)).toBeInTheDocument();
  });

  it('handles export to Excel', async () => {
    const user = userEvent.setup();
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalledWith(mockAuditData.auditLogs, 'AUDIT_LOGS');
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('handles export to CSV', async () => {
    const user = userEvent.setup();
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-csv');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalledWith(mockAuditData.auditLogs, 'AUDIT_LOGS');
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('handles export to PDF', async () => {
    const user = userEvent.setup();
    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-pdf');
    await user.click(exportButton);

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalledWith(mockAuditData.auditLogs, 'AUDIT_LOGS');
      expect(getColumnsForReport).toHaveBeenCalledWith('AUDIT_LOGS');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('Export failed');
    });

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByTestId('export-excel');
    await user.click(exportButton);

    expect(global.alert).toHaveBeenCalledWith('Export failed. Please try again.');
  });

  it('handles missing data gracefully', async () => {
    vi.mocked(useAuditLogs).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<AuditLogsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('audit-logs-stats-cards')).toBeInTheDocument();
      expect(screen.getByTestId('audit-logs-table')).toBeInTheDocument();
    });
  });

  it('passes correct dateRange to useAuditLogs', () => {
    render(<AuditLogsReport dateRange="last7" />, { wrapper: createWrapper() });

    expect(useAuditLogs).toHaveBeenCalledWith('last7');
  });
});

