import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EvidenceFindingsReport from '../EvidenceFindingsReport';
import { useEvidenceFindings } from '../../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../../shared/utils/exportUtils';
import { evidenceService } from '../../../cases/services/evidenceService';

// Mock hooks
vi.mock('../../hooks/useReports', () => ({
  useEvidenceFindings: vi.fn(),
}));

// Mock components
vi.mock('../../components/EvidenceFindingsStatsCards', () => ({
  default: ({ stats }: any) => (
    <div data-testid="evidence-findings-stats-cards">
      {JSON.stringify(stats)}
    </div>
  ),
}));

vi.mock('../../../../shared/components/PaginationControls', () => ({
  default: ({ currentPage, totalPages, onPageChange }: any) => (
    <div data-testid="pagination-controls">
      <button onClick={() => onPageChange(currentPage + 1)}>Next</button>
      <span>
        Page {currentPage} of {totalPages}
      </span>
    </div>
  ),
}));

// Mock services
vi.mock('../../../cases/services/evidenceService', () => ({
  evidenceService: {
    viewEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
    getEvidenceById: vi.fn(),
    formatFileSize: vi.fn((size) => `${size} bytes`),
  },
}));

// Mock export utilities
vi.mock('../../../../shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data) => data),
  getColumnsForReport: vi.fn(() => []),
}));

// Mock window methods
global.alert = vi.fn();
global.confirm = vi.fn(() => true);
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();
global.window.open = vi.fn();

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

describe('EvidenceFindingsReport', () => {
  const mockEvidenceData = {
    stats: {
      totalFindings: 10,
      evidenceItems: 25,
      confirmedFindings: 5,
      refutedFindings: 3,
    },
    statusDistribution: {
      confirmed: 5,
      refuted: 3,
      inconclusive: 2,
    },
    evidenceItems: [],
    findings: [
      {
        caseId: 'CASE-1',
        taskId: 'TASK-1',
        finding: 'Evidence collected for investigation',
        conclusion: 'Confirmed' as const,
        evidenceCount: 3,
        supportingEvidence: [
          {
            id: 'evidence-1',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        ],
        dateIdentified: '2024-01-01T10:00:00Z',
      },
      {
        caseId: 'CASE-2',
        finding: 'Another finding',
        conclusion: 'Refuted' as const,
        evidenceCount: 2,
        supportingEvidence: ['evidence-2', 'evidence-3'],
        dateIdentified: '2024-01-02T10:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: mockEvidenceData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  it('renders evidence findings report with data', async () => {
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('evidence-findings-stats-cards'),
      ).toBeInTheDocument();
      expect(screen.getByText('Evidence Findings Report')).toBeInTheDocument();
    });
  });

  it('renders loading state', () => {
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Evidence Findings Report')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isError: true,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText(/Failed to load evidence findings data/i),
    ).toBeInTheDocument();
  });

  it('handles search input', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Search findings/i),
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search findings/i);
    await user.type(searchInput, 'investigation');

    expect(searchInput).toHaveValue('investigation');
  });

  it('handles status filter', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole('combobox');
    await user.selectOptions(statusSelect, 'Confirmed');

    expect(statusSelect).toHaveValue('Confirmed');
  });

  it('handles export to Excel', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export to Excel');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('handles export to CSV', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export as CSV');
    await user.click(exportButton);

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('handles export to PDF', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export as PDF');
    await user.click(exportButton);

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalled();
      expect(getColumnsForReport).toHaveBeenCalledWith('EVIDENCE_FINDINGS');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('Export failed');
    });

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export to Excel');
    await user.click(exportButton);

    expect(global.alert).toHaveBeenCalledWith(
      'Export failed. Please try again.',
    );
  });

  it('handles missing data gracefully', async () => {
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('evidence-findings-stats-cards'),
      ).toBeInTheDocument();
    });
  });

  it('displays findings list', async () => {
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
      expect(screen.getByText('Another finding')).toBeInTheDocument();
    });
  });

  it('filters findings by search term', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Search findings/i),
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search findings/i);
    await user.type(searchInput, 'investigation');

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Another finding')).not.toBeInTheDocument();
    });
  });

  it('filters findings by status', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole('combobox');
    await user.selectOptions(statusSelect, 'Confirmed');

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Another finding')).not.toBeInTheDocument();
    });
  });

  it('expands and collapses finding details', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
    });

    const findingElement = screen
      .getByText('Evidence collected for investigation')
      .closest('div');
    if (findingElement) {
      await user.click(findingElement);

      await waitFor(() => {
        expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
      });
    }
  });

  it('uses default dateRange when not provided', () => {
    render(<EvidenceFindingsReport />, { wrapper: createWrapper() });

    expect(useEvidenceFindings).toHaveBeenCalledWith('last30');
  });
});
