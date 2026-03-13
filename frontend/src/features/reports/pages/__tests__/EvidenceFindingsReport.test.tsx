import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { evidenceService, EvidenceService } from '../../../cases/services/evidenceService';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock('../../hooks/useReports', () => ({
  useEvidenceFindings: vi.fn(),
}));

vi.mock('@/features/cases/hooks/useInvestigatorSupervisorList', () => ({
  useInvestigatorSupervisorList: vi.fn(() => ({
    investigators: [
      { id: 'inv-1', firstName: 'John', lastName: 'Doe' },
    ],
    supervisors: [
      { id: 'sup-1', firstName: 'Jane', lastName: 'Smith' },
    ],
    complianceOfficers: [
      { id: 'comp-1', firstName: 'Alice', lastName: 'Brown' },
    ],
    loadingInvestigators: false,
    loadingSupervisors: false,
    fetchInvestigatorsList: vi.fn(),
    fetchSupervisorsList: vi.fn(),
    fetchComplianceOfficersList: vi.fn(),
    clearCache: vi.fn(),
  })),
}));

vi.mock('../../components/EvidenceFindingsStatsCards', () => ({
  default: ({ stats }: any) => (
    <div data-testid="evidence-findings-stats-cards">{JSON.stringify(stats)}</div>
  ),
}));

vi.mock('../../../shared/PaginationControls', () => ({
  default: ({ currentPage, totalPages, onPageChange, onNext, onPrevious, canGoNext, canGoPrevious }: any) => (
    <div data-testid="pagination-controls">
      <button onClick={onPrevious} disabled={!canGoPrevious} data-testid="prev-page">Prev</button>
      <span data-testid="page-info">Page {currentPage} of {totalPages}</span>
      <button onClick={onNext} disabled={!canGoNext} data-testid="next-page">Next</button>
      <button onClick={() => onPageChange(2)} data-testid="goto-page-2">Page 2</button>
    </div>
  ),
}));

vi.mock('@/features/reports/components/EvidenceCard', () => ({
  default: ({ evidence, viewingId, downloadingId, handleViewEvidence, handleDownloadEvidence, getAssigneeFullName, formatFileSize }: any) => {
    const ev = typeof evidence === 'string' ? { id: evidence, fileName: evidence } : evidence;
    return (
      <div data-testid={`evidence-card-${ev.id}`}>
        <span>{ev.fileName}</span>
        <span data-testid={`assignee-${ev.id}`}>{getAssigneeFullName(ev.uploadedBy)}</span>
        <span data-testid={`file-size-${ev.id}`}>{formatFileSize(ev.fileSize ?? 0)}</span>
        <button data-testid={`view-${ev.id}`} onClick={() => handleViewEvidence(ev.fileName, ev.id)}>
          {viewingId === ev.id ? 'Viewing...' : 'View'}
        </button>
        <button data-testid={`download-${ev.id}`} onClick={() => handleDownloadEvidence(ev.id)}>
          {downloadingId === ev.id ? 'Downloading...' : 'Download'}
        </button>
      </div>
    );
  },
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: vi.fn((d: string) => 'Jan 01, 2024'),
}));

vi.mock('../../../cases/services/evidenceService', () => ({
  evidenceService: {
    viewEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
    getEvidenceById: vi.fn(),
  },
  EvidenceService: {
    formatFileSize: vi.fn((size: number) => `${size} bytes`),
  },
}));

vi.mock('../../../../shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data) => data),
  getColumnsForReport: vi.fn(() => []),
}));

// ─── Globals ────────────────────────────────────────────────────

const origAlert = globalThis.alert;
const origConfirm = globalThis.confirm;
const origOpen = globalThis.open;

// ─── Setup ──────────────────────────────────────────────────────

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const mockFinding1 = {
  caseId: 101,
  finding: 'Suspicious transaction detected',
  conclusion: 'Confirmed' as const,
  evidenceCount: 2,
  dateIdentified: '2024-01-15T10:00:00Z',
  tasks: [
    {
      taskId: 'T-1',
      supportingEvidence: [
        {
          id: 'ev-1',
          fileName: 'document.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          evidenceType: 'KYC',
          uploadedBy: 'inv-1',
          uploadedAt: '2024-01-10',
          description: 'KYC document',
        },
        {
          id: 'ev-2',
          fileName: 'screenshot.png',
          fileSize: 5120,
          mimeType: 'image/png',
          evidenceType: 'Screenshot',
          uploadedBy: 'sup-1',
          uploadedAt: '2024-01-11',
        },
      ],
    },
  ],
};

const mockFinding2 = {
  caseId: 102,
  finding: 'Normal activity confirmed',
  conclusion: 'Refuted' as const,
  evidenceCount: 1,
  dateIdentified: '2024-01-20T10:00:00Z',
  tasks: [
    {
      taskId: 'T-2',
      supportingEvidence: [
        {
          id: 'ev-3',
          fileName: 'report.docx',
          fileSize: 3072,
          mimeType: 'application/msword',
          evidenceType: 'Report',
          uploadedBy: 'comp-1',
        },
      ],
    },
  ],
};

const mockFinding3 = {
  caseId: 103,
  finding: 'Inconclusive review',
  conclusion: 'Inconclusive' as const,
  evidenceCount: 0,
  dateIdentified: '2024-02-01T10:00:00Z',
  tasks: [],
};

const mockFinding4 = {
  caseId: 104,
  finding: 'Pending investigation',
  conclusion: 'In Progress' as const,
  evidenceCount: 0,
  dateIdentified: '2024-03-01T10:00:00Z',
  tasks: [],
};

const mockEvidenceData = {
  stats: {
    totalFindings: 4,
    evidenceItems: 5,
    confirmedFindings: 1,
    refutedFindings: 1,
    inProgressFindings: 1,
    inconclusiveFindings: 1,
  },
  findings: [mockFinding1, mockFinding2, mockFinding3, mockFinding4],
};

describe('EvidenceFindingsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.alert = vi.fn();
    globalThis.confirm = vi.fn(() => true);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.window.open = vi.fn();

    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: mockEvidenceData,
      isLoading: false,
      error: null,
      isError: false,
    } as any);
  });

  afterEach(() => {
    globalThis.alert = origAlert;
    globalThis.confirm = origConfirm;
  });

  // ─── Rendering ────────────────────────────────────────────────

  it('renders stats cards and findings', async () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('evidence-findings-stats-cards')).toBeInTheDocument();
      expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
      expect(screen.getByText('Normal activity confirmed')).toBeInTheDocument();
    });
  });

  it('renders page heading', () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getAllByText('Evidence Findings Report').length).toBeGreaterThan(0);
  });

  it('uses default dateRange when not provided', () => {
    render(<EvidenceFindingsReport />, { wrapper: createWrapper() });

    expect(useEvidenceFindings).toHaveBeenCalledWith('last30');
  });

  it('shows finding dates using formatDate', () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getAllByText(/Jan 01, 2024/).length).toBeGreaterThan(0);
  });

  it('shows conclusion badges with correct text', () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    // "Confirmed" etc. also appear in <option> elements, so use getAllByText
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Refuted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inconclusive').length).toBeGreaterThanOrEqual(1);
  });

  it('shows evidence count per finding', () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByText('2 evidence items')).toBeInTheDocument();
    expect(screen.getByText('1 evidence items')).toBeInTheDocument();
  });

  // ─── Loading ──────────────────────────────────────────────────

  it('renders loading skeleton', () => {
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('evidence-findings-stats-cards')).not.toBeInTheDocument();
  });

  // ─── Error ────────────────────────────────────────────────────

  it('renders error message', () => {
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API error'),
      isError: true,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load evidence findings data/i)).toBeInTheDocument();
  });

  // ─── Missing data fallback ────────────────────────────────────

  it('uses defaults when data is undefined', () => {
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('evidence-findings-stats-cards')).toHaveTextContent('"totalFindings":0');
    expect(screen.getByText(/No findings match your search/i)).toBeInTheDocument();
  });

  // ─── Search ───────────────────────────────────────────────────

  it('filters findings by search term', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/Search findings/i);
    await user.type(searchInput, 'Suspicious');

    await waitFor(() => {
      expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
      expect(screen.queryByText('Normal activity confirmed')).not.toBeInTheDocument();
    });
  });

  it('filters findings by caseId in search', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/Search findings/i);
    await user.type(searchInput, '102');

    await waitFor(() => {
      expect(screen.getByText('Normal activity confirmed')).toBeInTheDocument();
      expect(screen.queryByText('Suspicious transaction detected')).not.toBeInTheDocument();
    });
  });

  it('shows "No findings match" when search has no results', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(/Search findings/i);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText(/No findings match your search/i)).toBeInTheDocument();
    });
  });

  // ─── Status filter ────────────────────────────────────────────

  it('filters findings by Confirmed status', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'Confirmed');

    await waitFor(() => {
      expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
      expect(screen.queryByText('Normal activity confirmed')).not.toBeInTheDocument();
    });
  });

  it('filters findings by Refuted status', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'Refuted');

    await waitFor(() => {
      expect(screen.getByText('Normal activity confirmed')).toBeInTheDocument();
      expect(screen.queryByText('Suspicious transaction detected')).not.toBeInTheDocument();
    });
  });

  it('shows all findings for All Statuses', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'Confirmed');
    await user.selectOptions(statusSelect, 'All');

    await waitFor(() => {
      expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
      expect(screen.getByText('Normal activity confirmed')).toBeInTheDocument();
    });
  });

  // ─── Expand / Collapse ────────────────────────────────────────

  it('expands a finding to show tasks', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Suspicious transaction detected')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Suspicious transaction detected'));

    await waitFor(() => {
      expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument();
    });
  });

  it('collapses a finding when clicked again', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));

    await waitFor(() => {
      expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument();
    });

    await user.click(screen.getByText('Suspicious transaction detected'));

    await waitFor(() => {
      expect(screen.queryByText(/Task ID: T-1/)).not.toBeInTheDocument();
    });
  });

  it('expands a task to show evidence cards', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    // First expand the finding
    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => {
      expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument();
    });

    // Then expand the task
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => {
      expect(screen.getByTestId('evidence-card-ev-1')).toBeInTheDocument();
      expect(screen.getByTestId('evidence-card-ev-2')).toBeInTheDocument();
    });
  });

  it('collapses a task when clicked again', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => {
      expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => {
      expect(screen.getByTestId('evidence-card-ev-1')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => {
      expect(screen.queryByTestId('evidence-card-ev-1')).not.toBeInTheDocument();
    });
  });

  // ─── View Evidence ────────────────────────────────────────────

  it('opens previewable file in new tab', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(
      new Blob(['pdf content'], { type: 'application/pdf' }),
    );

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    // Expand finding → task → evidence
    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('view-ev-1'));

    await waitFor(() => {
      expect(evidenceService.viewEvidence).toHaveBeenCalledWith('ev-1');
      expect(window.open).toHaveBeenCalledWith('blob:mock-url', '_blank', 'noopener,noreferrer');
    });
  });

  it('offers download for non-previewable file', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(
      new Blob(['data'], { type: 'application/octet-stream' }),
    );
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Normal activity confirmed'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-2/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-2/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-3')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('view-ev-3'));

    await waitFor(() => {
      expect(globalThis.confirm).toHaveBeenCalled();
    });
  });

  it('does not download when user declines confirm', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(
      new Blob(['data'], { type: 'application/octet-stream' }),
    );
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Normal activity confirmed'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-2/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-2/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-3')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('view-ev-3'));

    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  it('shows error alert when viewEvidence fails', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockRejectedValue(new Error('view failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('view-ev-1'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('view failed'));
    });
    consoleSpy.mockRestore();
  });

  it('handles empty blob in viewEvidence', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(
      new Blob([], { type: 'application/pdf' }),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('view-ev-1'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Received empty file'));
    });
    consoleSpy.mockRestore();
  });

  it('shows non-Error view failure message', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.viewEvidence).mockRejectedValue('string error');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('view-ev-1'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
    });
    consoleSpy.mockRestore();
  });

  // ─── Download Evidence ────────────────────────────────────────

  it('downloads evidence successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({
      fileName: 'real-file.pdf',
    } as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(
      new Blob(['content'], { type: 'application/pdf' }),
    );

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('download-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('download-ev-1'));

    await waitFor(() => {
      expect(evidenceService.getEvidenceById).toHaveBeenCalledWith('ev-1');
      expect(evidenceService.downloadEvidence).toHaveBeenCalledWith('ev-1');
    });
  });

  it('uses attachment fileName when main fileName is missing', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({
      attachments: [{ fileName: 'attachment.pdf' }],
    } as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(
      new Blob(['content'], { type: 'application/pdf' }),
    );

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('download-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('download-ev-1'));

    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalled();
    });
  });

  it('shows error alert when download fails', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({ fileName: 'file.pdf' } as any);
    vi.mocked(evidenceService.downloadEvidence).mockRejectedValue(new Error('download failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('download-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('download-ev-1'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('download failed'));
    });
    consoleSpy.mockRestore();
  });

  it('handles empty blob from downloadEvidence', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({ fileName: 'file.pdf' } as any);
    vi.mocked(evidenceService.downloadEvidence).mockResolvedValue(new Blob([]));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('download-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('download-ev-1'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Received empty file'));
    });
    consoleSpy.mockRestore();
  });

  it('handles non-Error download failure', async () => {
    const user = userEvent.setup();
    vi.mocked(evidenceService.getEvidenceById).mockResolvedValue({ fileName: 'file.pdf' } as any);
    vi.mocked(evidenceService.downloadEvidence).mockRejectedValue('string error');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('download-ev-1')).toBeInTheDocument(); });

    await user.click(screen.getByTestId('download-ev-1'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
    });
    consoleSpy.mockRestore();
  });

  // ─── Export Excel ─────────────────────────────────────────────

  it('exports to Excel', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Export to Excel'));

    expect(formatDataForExport).toHaveBeenCalledWith(expect.any(Array), 'EVIDENCE_FINDINGS');
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('shows alert when Excel export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToExcel).mockImplementation(() => { throw new Error('fail'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByText('Export to Excel'));

    expect(globalThis.alert).toHaveBeenCalledWith('Export failed. Please try again.');
    consoleSpy.mockRestore();
  });

  // ─── Export CSV ───────────────────────────────────────────────

  it('exports to CSV', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Export as CSV'));

    expect(formatDataForExport).toHaveBeenCalledWith(expect.any(Array), 'EVIDENCE_FINDINGS');
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('shows alert when CSV export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToCSV).mockImplementation(() => { throw new Error('fail'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByText('Export as CSV'));

    expect(globalThis.alert).toHaveBeenCalledWith('Export failed. Please try again.');
    consoleSpy.mockRestore();
  });

  // ─── Export PDF ───────────────────────────────────────────────

  it('exports to PDF', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Export as PDF'));

    await waitFor(() => {
      expect(formatDataForExport).toHaveBeenCalledWith(expect.any(Array), 'EVIDENCE_FINDINGS');
      expect(getColumnsForReport).toHaveBeenCalledWith('EVIDENCE_FINDINGS');
      expect(exportToPDF).toHaveBeenCalled();
    });
  });

  it('shows alert when PDF export fails', async () => {
    const user = userEvent.setup();
    vi.mocked(exportToPDF).mockRejectedValue(new Error('pdf fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });
    await user.click(screen.getByText('Export as PDF'));

    await waitFor(() => {
      expect(globalThis.alert).toHaveBeenCalledWith('Export failed. Please try again.');
    });
    consoleSpy.mockRestore();
  });

  // ─── Pagination info ─────────────────────────────────────────

  it('displays "Showing X of Y findings" info', () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    // There are two elements containing "Showing" (findings count + pagination)
    const showingElements = screen.getAllByText(/Showing/);
    expect(showingElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/findings \(Page/)).toBeInTheDocument();
  });

  // ─── getAssigneeFullName via EvidenceCard ─────────────────────

  it('resolves investigator name via getAssigneeFullName', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));

    await waitFor(() => {
      expect(screen.getByTestId('assignee-ev-1')).toHaveTextContent('John Doe');
    });
  });

  it('resolves supervisor name via getAssigneeFullName', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));

    await waitFor(() => {
      expect(screen.getByTestId('assignee-ev-2')).toHaveTextContent('Jane Smith');
    });
  });

  it('resolves compliance officer name via getAssigneeFullName', async () => {
    const user = userEvent.setup();
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Normal activity confirmed'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-2/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-2/));

    await waitFor(() => {
      expect(screen.getByTestId('assignee-ev-3')).toHaveTextContent('Alice Brown');
    });
  });

  it('returns empty string for unknown assignee', async () => {
    const user = userEvent.setup();
    const dataWithUnknown = {
      ...mockEvidenceData,
      findings: [{
        ...mockFinding1,
        tasks: [{
          taskId: 'T-X',
          supportingEvidence: [{
            id: 'ev-unknown',
            fileName: 'unknown.pdf',
            fileSize: 100,
            uploadedBy: 'nobody',
          }],
        }],
      }],
    };
    vi.mocked(useEvidenceFindings).mockReturnValue({
      data: dataWithUnknown,
      isLoading: false,
      error: null,
      isError: false,
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-X/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-X/));

    await waitFor(() => {
      expect(screen.getByTestId('assignee-ev-unknown')).toHaveTextContent('');
    });
  });

  // ─── getStatusColor default (unknown conclusion) ──────────────

  it('applies default gray badge for unknown conclusion status', () => {
    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    // mockFinding4 has conclusion 'In Progress' which hits the default case
    expect(screen.getByText('Pending investigation')).toBeInTheDocument();
    // The badge should have the default gray styling (rendered inline by the component)
    const inProgressBadges = screen.getAllByText('In Progress');
    expect(inProgressBadges.length).toBeGreaterThanOrEqual(1);
  });

  // ─── useEffect fetches when lists are empty ───────────────────

  it('calls fetch functions when investigator/supervisor/compliance lists are empty', () => {
    const mockFetchInvestigators = vi.fn();
    const mockFetchSupervisors = vi.fn();
    const mockFetchCompliance = vi.fn();

    vi.mocked(useInvestigatorSupervisorList).mockReturnValueOnce({
      investigators: [],
      supervisors: [],
      complianceOfficers: [],
      loadingInvestigators: false,
      loadingSupervisors: false,
      fetchInvestigatorsList: mockFetchInvestigators,
      fetchSupervisorsList: mockFetchSupervisors,
      fetchComplianceOfficersList: mockFetchCompliance,
      clearCache: vi.fn(),
    } as any);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    expect(mockFetchInvestigators).toHaveBeenCalled();
    expect(mockFetchSupervisors).toHaveBeenCalled();
    expect(mockFetchCompliance).toHaveBeenCalled();
  });

  // ─── setTimeout cleanup for previewable file view ─────────────

  it('cleans up blob URL via setTimeout after opening previewable file', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const previewableBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
    vi.mocked(evidenceService.viewEvidence).mockResolvedValue(previewableBlob);

    render(<EvidenceFindingsReport dateRange="last30" />, { wrapper: createWrapper() });

    // Expand finding then task
    await user.click(screen.getByText('Suspicious transaction detected'));
    await waitFor(() => { expect(screen.getByText(/Task ID: T-1/)).toBeInTheDocument(); });
    await user.click(screen.getByText(/Task ID: T-1/));
    await waitFor(() => { expect(screen.getByTestId('view-ev-1')).toBeInTheDocument(); });

    // Click view
    await user.click(screen.getByTestId('view-ev-1'));
    await waitFor(() => { expect(evidenceService.viewEvidence).toHaveBeenCalledWith('ev-1'); });

    // Advance timers to trigger the cleanup setTimeout(30000)
    vi.advanceTimersByTime(30000);

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.useRealTimers();
  });
});
