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

vi.mock('../../components/EvidenceCard', () => ({
  default: ({
    evidence,
    handleViewEvidence,
    handleDownloadEvidence,
    viewingId,
    downloadingId,
    getAssigneeFullName,
    formatFileSize,
  }: any) => {
    const id = typeof evidence === 'string' ? evidence : evidence.id;
    const fileName =
      typeof evidence === 'string' ? evidence : evidence.fileName;
    return (
      <div data-testid={`evidence-card-${id}`}>
        <span>{fileName}</span>
        <span data-testid="assignee-name">
          {getAssigneeFullName(
            typeof evidence === 'object' ? evidence.uploadedBy : undefined,
          )}
        </span>
        <span data-testid="file-size">
          {typeof evidence === 'object' && evidence.fileSize
            ? formatFileSize(evidence.fileSize)
            : ''}
        </span>
        <button
          data-testid={`view-btn-${id}`}
          onClick={() => handleViewEvidence(fileName, id)}
        >
          {viewingId === id ? 'Viewing...' : 'View'}
        </button>
        <button
          data-testid={`download-btn-${id}`}
          onClick={() => handleDownloadEvidence(id)}
        >
          {downloadingId === id ? 'Downloading...' : 'Download'}
        </button>
      </div>
    );
  },
}));

// Mock services
vi.mock('../../../cases/services/evidenceService', () => ({
  evidenceService: {
    viewEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
    getEvidenceById: vi.fn(),
    formatFileSize: vi.fn((size: number) => `${size} bytes`),
  },
}));

// Mock export utilities
vi.mock('../../../../shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data: any) => data),
  getColumnsForReport: vi.fn(() => []),
}));

const mockFetchInvestigators = vi.fn();
const mockFetchSupervisors = vi.fn();
const mockFetchCompliance = vi.fn();
const mockUseInvestigatorSupervisorList = vi.fn();

vi.mock('@/features/cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: (...args: any[]) =>
    mockUseInvestigatorSupervisorList(...args),
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d,
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
        tasks: [
          {
            taskId: 'TASK-1',
            taskTitle: 'Investigation Task',
            findings: [
              {
                finding: 'Evidence collected for investigation',
                conclusion: 'Confirmed',
              },
            ],
            evidence: [
              {
                id: 'evidence-1',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
              },
            ],
            supportingEvidence: [
              {
                id: 'evidence-1',
                fileName: 'document.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
              },
            ],
          },
        ],
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
        tasks: [],
        supportingEvidence: ['evidence-2', 'evidence-3'],
        dateIdentified: '2024-01-02T10:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInvestigatorSupervisorList.mockReturnValue({
      investigators: [],
      supervisors: [],
      complianceOfficers: [],
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      fetchComplianceOfficersList: mockFetchCompliance,
    });
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

    const statusSelect = screen.getByDisplayValue('All Statuses');
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

    const statusSelect = screen.getByDisplayValue('All Statuses');
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
      .closest('div[class*="cursor-pointer"]');
    if (findingElement) {
      await user.click(findingElement);

      await waitFor(() => {
        expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
      });
    }
  });

  it('uses default dateRange when not provided', () => {
    render(<EvidenceFindingsReport />, { wrapper: createWrapper() });

    expect(useEvidenceFindings).toHaveBeenCalledWith('last30');
  });

  it('handles view evidence for previewable file', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['pdf content'], { type: 'application/pdf' });
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(mockBlob);

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
    });

    // Expand the finding
    const findingElement = screen
      .getByText('Evidence collected for investigation')
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    // Expand the task
    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('view-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-btn-evidence-1'));

    await waitFor(() => {
      expect(evidenceService.viewEvidence).toHaveBeenCalledWith('evidence-1');
      expect(window.open).toHaveBeenCalledWith(
        'blob:mock-url',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('handles download evidence', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({
      fileName: 'report.pdf',
    } as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(mockBlob);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('download-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('download-btn-evidence-1'));

    await waitFor(() => {
      expect(evidenceService.getEvidenceById).toHaveBeenCalledWith(
        'evidence-1',
      );
      expect(evidenceService.downloadEvidence).toHaveBeenCalledWith(
        'evidence-1',
      );
    });
  });

  it('handles view evidence error', async () => {
    vi.mocked(evidenceService.viewEvidence).mockRejectedValue(
      new Error('View failed'),
    );

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('view-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-btn-evidence-1'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to view evidence'),
      );
    });
  });

  it('handles export CSV error gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToCSV).mockImplementation(() => {
      throw new Error('CSV export failed');
    });

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export as CSV'));
    expect(global.alert).toHaveBeenCalledWith(
      'Export failed. Please try again.',
    );
  });

  it('handles export PDF error gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToPDF).mockRejectedValue(new Error('PDF export failed'));

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export as PDF'));
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        'Export failed. Please try again.',
      );
    });
  });

  it('handles non-previewable file on view evidence', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['binary'], { type: 'application/zip' });
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(mockBlob);
    vi.mocked(global.confirm).mockReturnValue(false);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('view-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-btn-evidence-1'));

    await waitFor(() => {
      expect(evidenceService.viewEvidence).toHaveBeenCalled();
      expect(global.confirm).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  it('shows no findings match message when search filters out everything', async () => {
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
    await user.type(searchInput, 'zzzznonexistent');

    await waitFor(() => {
      expect(
        screen.getByText('No findings match your search criteria'),
      ).toBeInTheDocument();
    });
  });

  it('handles Inconclusive status filter', async () => {
    const user = userEvent.setup();
    const dataWithInconclusive = {
      ...mockEvidenceData,
      findings: [
        ...mockEvidenceData.findings,
        {
          caseId: 'CASE-3',
          finding: 'Inconclusive evidence',
          conclusion: 'Inconclusive' as const,
          evidenceCount: 1,
          tasks: [],
          supportingEvidence: [],
          dateIdentified: '2024-01-03T10:00:00Z',
        },
      ],
    };
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: dataWithInconclusive,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'Inconclusive');

    await waitFor(() => {
      expect(screen.getByText('Inconclusive evidence')).toBeInTheDocument();
      expect(screen.queryByText('Another finding')).not.toBeInTheDocument();
    });
  });

  it('renders status badge colors for different conclusions', async () => {
    const dataWithAll = {
      ...mockEvidenceData,
      findings: [
        { ...mockEvidenceData.findings[0], conclusion: 'Confirmed' },
        { ...mockEvidenceData.findings[1], conclusion: 'Refuted' },
        {
          caseId: 'CASE-3',
          finding: 'Maybe finding',
          conclusion: 'Inconclusive',
          evidenceCount: 0,
          tasks: [],
          supportingEvidence: [],
          dateIdentified: '2024-01-03T10:00:00Z',
        },
        {
          caseId: 'CASE-4',
          finding: 'Unknown finding',
          conclusion: 'Unknown',
          evidenceCount: 0,
          tasks: [],
          supportingEvidence: [],
          dateIdentified: '2024-01-04T10:00:00Z',
        },
      ],
    };
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: dataWithAll,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Refuted').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inconclusive').length).toBeGreaterThanOrEqual(
        1,
      );
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  it('expands task within finding and shows supporting evidence', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
    });

    // Expand finding
    const findingElement = screen
      .getByText('Evidence collected for investigation')
      .closest('div[class*="cursor-pointer"]');
    if (findingElement) {
      await user.click(findingElement);
    }

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    // Expand task
    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    if (taskHeader) {
      await user.click(taskHeader);
    }
  });

  it('collapses finding on second click', async () => {
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
      .closest('div[class*="cursor-pointer"]');

    if (findingElement) {
      // Expand
      await user.click(findingElement);
      await waitFor(() => {
        expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
      });

      // Collapse
      await user.click(findingElement);
      await waitFor(() => {
        expect(screen.queryByText(/Task ID: TASK-1/)).not.toBeInTheDocument();
      });
    }
  });

  it('handles download evidence with fallback fileName from attachments', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({
      attachments: [{ fileName: 'attachment.pdf' }],
    } as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(mockBlob);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('download-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('download-btn-evidence-1'));

    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalled();
    });
  });

  it('handles download evidence error', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockRejectedValue(
      new Error('Not found'),
    );

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('download-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('download-btn-evidence-1'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download file'),
      );
    });
  });

  it('handles view evidence with empty blob', async () => {
    const user = userEvent.setup();
    const emptyBlob = new Blob([], { type: 'application/pdf' });
    Object.defineProperty(emptyBlob, 'size', { value: 0 });
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(emptyBlob);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('view-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-btn-evidence-1'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to view evidence'),
      );
    });
  });

  it('handles non-previewable file download when user confirms', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['bin'], { type: 'application/octet-stream' });
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(mockBlob);
    vi.mocked(global.confirm).mockReturnValue(true);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('view-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-btn-evidence-1'));

    await waitFor(() => {
      expect(evidenceService.viewEvidence).toHaveBeenCalled();
      expect(global.confirm).toHaveBeenCalled();
    });
  });

  it('handles non-Error exception in view evidence', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockRejectedValue('string-error');

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('view-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('view-btn-evidence-1'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error'),
      );
    });
  });

  it('handles non-Error exception in download evidence', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockRejectedValue(
      'not-an-error',
    );

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('download-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('download-btn-evidence-1'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error'),
      );
    });
  });

  it('shows Investigation Findings heading and results info', async () => {
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Investigation Findings')).toBeInTheDocument();
      expect(screen.getAllByText(/Showing/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles download evidence with empty blob', async () => {
    const user = userEvent.setup();
    const emptyBlob = new Blob([], { type: 'application/pdf' });
    Object.defineProperty(emptyBlob, 'size', { value: 0 });
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({
      fileName: 'test.pdf',
    } as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(emptyBlob);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('download-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('download-btn-evidence-1'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Received empty file'),
      );
    });
  });

  it('calls fetch functions on mount when lists are empty', async () => {
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetchInvestigators).toHaveBeenCalled();
      expect(mockFetchSupervisors).toHaveBeenCalled();
      expect(mockFetchCompliance).toHaveBeenCalled();
    });
  });

  it('does not call fetch when lists are already populated', async () => {
    mockUseInvestigatorSupervisorList.mockReturnValue({
      investigators: [{ id: 'inv-1', firstName: 'Jane', lastName: 'Inv' }],
      supervisors: [{ id: 'sup-1', firstName: 'John', lastName: 'Sup' }],
      complianceOfficers: [{ id: 'co-1', firstName: 'May', lastName: 'CO' }],
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      fetchComplianceOfficersList: mockFetchCompliance,
    });

    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText('Evidence Findings Report')).toBeInTheDocument();
    });

    expect(mockFetchInvestigators).not.toHaveBeenCalled();
    expect(mockFetchSupervisors).not.toHaveBeenCalled();
    expect(mockFetchCompliance).not.toHaveBeenCalled();
  });

  it('resolves assignee full name from compliance officers', async () => {
    mockUseInvestigatorSupervisorList.mockReturnValue({
      investigators: [],
      supervisors: [],
      complianceOfficers: [{ id: 'co-1', firstName: 'May', lastName: 'CO' }],
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      fetchComplianceOfficersList: mockFetchCompliance,
    });

    const dataWithUploadedBy = {
      ...mockEvidenceData,
      findings: [
        {
          ...mockEvidenceData.findings[0],
          tasks: [
            {
              ...mockEvidenceData.findings[0].tasks[0],
              supportingEvidence: [
                {
                  id: 'evidence-1',
                  fileName: 'document.pdf',
                  fileSize: 1024,
                  mimeType: 'application/pdf',
                  uploadedBy: 'co-1',
                },
              ],
            },
          ],
        },
      ],
    };
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: dataWithUploadedBy,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('assignee-name')).toHaveTextContent('May CO');
    });
  });

  it('resolves assignee name from investigators list', async () => {
    mockUseInvestigatorSupervisorList.mockReturnValue({
      investigators: [{ id: 'inv-1', firstName: 'Jane', lastName: 'Inv' }],
      supervisors: [],
      complianceOfficers: [],
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      fetchComplianceOfficersList: mockFetchCompliance,
    });

    const dataWithUploadedBy = {
      ...mockEvidenceData,
      findings: [
        {
          ...mockEvidenceData.findings[0],
          tasks: [
            {
              ...mockEvidenceData.findings[0].tasks[0],
              supportingEvidence: [
                {
                  id: 'evidence-1',
                  fileName: 'document.pdf',
                  fileSize: 1024,
                  mimeType: 'application/pdf',
                  uploadedBy: 'inv-1',
                },
              ],
            },
          ],
        },
      ],
    };
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: dataWithUploadedBy,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('assignee-name')).toHaveTextContent('Jane Inv');
    });
  });

  it('resolves assignee name from supervisors list', async () => {
    mockUseInvestigatorSupervisorList.mockReturnValue({
      investigators: [],
      supervisors: [{ id: 'sup-1', firstName: 'John', lastName: 'Sup' }],
      complianceOfficers: [],
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      fetchComplianceOfficersList: mockFetchCompliance,
    });

    const dataWithUploadedBy = {
      ...mockEvidenceData,
      findings: [
        {
          ...mockEvidenceData.findings[0],
          tasks: [
            {
              ...mockEvidenceData.findings[0].tasks[0],
              supportingEvidence: [
                {
                  id: 'evidence-1',
                  fileName: 'document.pdf',
                  fileSize: 1024,
                  mimeType: 'application/pdf',
                  uploadedBy: 'sup-1',
                },
              ],
            },
          ],
        },
      ],
    };
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: dataWithUploadedBy,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('assignee-name')).toHaveTextContent('John Sup');
    });
  });

  it('handles download evidence with fallback to generic evidence name', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({} as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(mockBlob);

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
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('download-btn-evidence-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('download-btn-evidence-1'));

    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalledWith(
        'evidence-1',
      );
    });
  });

  it('collapses expanded task on second click', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText('Evidence collected for investigation'),
      ).toBeInTheDocument();
    });

    // Expand finding
    const findingElement = screen
      .getByText('Evidence collected for investigation')
      .closest('div[class*="cursor-pointer"]');
    await user.click(findingElement!);

    await waitFor(() => {
      expect(screen.getByText(/Task ID: TASK-1/)).toBeInTheDocument();
    });

    // Expand task
    const taskHeader = screen
      .getByText(/Task ID: TASK-1/)
      .closest('div[class*="cursor-pointer"]');
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(
        screen.getByTestId('evidence-card-evidence-1'),
      ).toBeInTheDocument();
    });

    // Collapse task
    await user.click(taskHeader!);

    await waitFor(() => {
      expect(
        screen.queryByTestId('evidence-card-evidence-1'),
      ).not.toBeInTheDocument();
    });
  });
});
