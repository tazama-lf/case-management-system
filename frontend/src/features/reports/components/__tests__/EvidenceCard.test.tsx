import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EvidenceCard } from '../EvidenceCard';

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: vi.fn((d: string) => 'Jan 15, 2024'),
}));

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const mockHandleView = vi.fn();
const mockHandleDownload = vi.fn();
const mockGetAssignee = vi.fn(() => 'John Doe');
const mockFormatFileSize = vi.fn((size: number) => `${size} bytes`);

const fullEvidence = {
  id: 'ev-1',
  fileName: 'document.pdf',
  fileSize: 2048,
  mimeType: 'application/pdf',
  evidenceType: 'KYC',
  uploadedBy: 'user-1',
  uploadedByName: 'John Doe',
  uploadedAt: '2024-01-15T10:00:00Z',
  description: 'Important KYC document',
  hash: 'abc123',
};

describe('EvidenceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAssignee.mockReturnValue('John Doe');
  });

  // ─── Rendering with full object evidence ────────────────────

  it('renders evidence card with full object data', () => {
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText(/ev-1/)).toBeInTheDocument();
    expect(screen.getByText('Important KYC document')).toBeInTheDocument();
    expect(screen.getByText('2048 bytes')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByText('KYC')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
  });

  // ─── Rendering with string evidence ─────────────────────────

  it('renders evidence card with string evidence', () => {
    render(
      <EvidenceCard
        evidence="simple-evidence-id"
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getAllByText('simple-evidence-id').length).toBeGreaterThanOrEqual(1);
  });

  // ─── View button ────────────────────────────────────────────

  it('calls handleViewEvidence on view button click', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    await user.click(screen.getByTitle('View evidence'));
    expect(mockHandleView).toHaveBeenCalledWith('document.pdf', 'ev-1');
  });

  it('shows spinner when viewing', () => {
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId="ev-1"
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getByTitle('Loading...')).toBeInTheDocument();
  });

  it('disables view button when downloading', () => {
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId={null}
        downloadingId="ev-1"
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    const viewBtn = screen.getByTitle('View evidence');
    expect(viewBtn).toBeDisabled();
  });

  // ─── Download button ────────────────────────────────────────

  it('calls handleDownloadEvidence on download button click', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    await user.click(screen.getByTitle('Download evidence'));
    expect(mockHandleDownload).toHaveBeenCalledWith('ev-1');
  });

  it('shows spinner when downloading', () => {
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId={null}
        downloadingId="ev-1"
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getByTitle('Downloading...')).toBeInTheDocument();
  });

  it('disables download button when viewing', () => {
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId="ev-1"
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    const downloadBtn = screen.getByTitle('Download evidence');
    expect(downloadBtn).toBeDisabled();
  });

  // ─── Uploaded By display ────────────────────────────────────

  it('shows assigned user name when getAssigneeFullName returns non-empty', () => {
    mockGetAssignee.mockReturnValue('Jane Smith');
    render(
      <EvidenceCard
        evidence={fullEvidence}
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows uploadedBy ID when getAssigneeFullName returns empty and no uploadedByName', () => {
    mockGetAssignee.mockReturnValue('');
    const evidenceNoName = { ...fullEvidence, uploadedByName: undefined };
    render(
      <EvidenceCard
        evidence={evidenceNoName}
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={mockGetAssignee}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getByText('user-1')).toBeInTheDocument();
  });

  // ─── Conditional detail display ─────────────────────────────

  it('does not show optional fields when not present', () => {
    const minimalEvidence = {
      id: 'ev-min',
      fileName: 'minimal.txt',
    };
    render(
      <EvidenceCard
        evidence={minimalEvidence}
        viewingId={null}
        downloadingId={null}
        handleViewEvidence={mockHandleView}
        handleDownloadEvidence={mockHandleDownload}
        getAssigneeFullName={vi.fn(() => '')}
        formatFileSize={mockFormatFileSize}
      />,
    );

    expect(screen.getByText('minimal.txt')).toBeInTheDocument();
    expect(screen.queryByText('Size:')).not.toBeInTheDocument();
    expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    expect(screen.queryByText('Category:')).not.toBeInTheDocument();
    expect(screen.queryByText('Uploaded:')).not.toBeInTheDocument();
  });
});
