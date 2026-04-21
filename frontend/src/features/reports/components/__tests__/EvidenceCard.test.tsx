import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EvidenceCard } from '../EvidenceCard';

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d,
}));

describe('EvidenceCard', () => {
  const defaultProps = {
    evidence: {
      id: 'ev-1',
      fileName: 'report.pdf',
      fileSize: 1024,
      uploadedBy: 'user-1',
      description: 'Test evidence file',
    },
    viewingId: null,
    downloadingId: null,
    handleViewEvidence: vi.fn(),
    handleDownloadEvidence: vi.fn(),
    getAssigneeFullName: (id?: string) => id || 'Unknown',
    formatFileSize: (size: number) => `${size} bytes`,
  };

  it('renders evidence file name', () => {
    render(<EvidenceCard {...defaultProps} />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('renders evidence ID', () => {
    render(<EvidenceCard {...defaultProps} />);
    expect(screen.getByText('ev-1')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<EvidenceCard {...defaultProps} />);
    expect(screen.getByText('Test evidence file')).toBeInTheDocument();
  });

  it('handles string evidence', () => {
    render(<EvidenceCard {...defaultProps} evidence="simple-evidence" />);
    expect(screen.getAllByText('simple-evidence').length).toBeGreaterThan(0);
  });

  it('calls handleViewEvidence on view button click', () => {
    render(<EvidenceCard {...defaultProps} />);
    const viewButton = screen.getByTitle('View evidence');
    fireEvent.click(viewButton);
    expect(defaultProps.handleViewEvidence).toHaveBeenCalledWith('report.pdf', 'ev-1');
  });

  it('calls handleDownloadEvidence on download button click', () => {
    render(<EvidenceCard {...defaultProps} />);
    const downloadButton = screen.getByTitle('Download evidence');
    fireEvent.click(downloadButton);
    expect(defaultProps.handleDownloadEvidence).toHaveBeenCalledWith('ev-1');
  });

  it('disables buttons when viewing', () => {
    render(<EvidenceCard {...defaultProps} viewingId="ev-1" />);
    const viewButton = screen.getByTitle('Loading...');
    expect(viewButton).toBeDisabled();
  });
});
