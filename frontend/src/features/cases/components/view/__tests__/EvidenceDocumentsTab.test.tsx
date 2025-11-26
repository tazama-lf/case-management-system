import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EvidenceDocumentsTab from '../EvidenceDocumentsTab';
import {
  useCaseEvidence,
  useUploadEvidence,
  useVerifyEvidence,
  useDeleteEvidence,
  useDownloadEvidence,
} from '../../../hooks/useEvidence';

vi.mock('../../../hooks/useEvidence');

describe('EvidenceDocumentsTab', () => {
  const mockEvidenceData = {
    evidence: [
      {
        evidence_id: 'EVIDENCE-1',
        file_name: 'test.pdf',
        evidence_type: 'DOCUMENT',
        file_size: 1024,
        uploaded_at: '2023-01-01T00:00:00Z',
        uploader_id: 'user-1',
        uploader_name: 'John Doe',
        description: 'Test evidence',
        verified: false,
        file_hash: 'abc123',
        tags: ['tag1'],
        access_level: 'CONFIDENTIAL',
      },
    ],
    pagination: {
      page: 1,
      totalPages: 1,
      total: 1,
    },
  };

  const mockUploadMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockVerifyMutation = {
    mutate: vi.fn(),
    isPending: false,
  };

  const mockDeleteMutation = {
    mutate: vi.fn(),
    isPending: false,
  };

  const mockDownloadMutation = {
    mutate: vi.fn(),
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useCaseEvidence as vi.Mock).mockReturnValue({
      data: mockEvidenceData,
      isLoading: false,
      refetch: vi.fn(),
    });
    (useUploadEvidence as vi.Mock).mockReturnValue(mockUploadMutation);
    (useVerifyEvidence as vi.Mock).mockReturnValue(mockVerifyMutation);
    (useDeleteEvidence as vi.Mock).mockReturnValue(mockDeleteMutation);
    (useDownloadEvidence as vi.Mock).mockReturnValue(mockDownloadMutation);
  });

  it('renders evidence list', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText('Test evidence')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useCaseEvidence as vi.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      refetch: vi.fn(),
    });

    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays empty state when no evidence', () => {
    (useCaseEvidence as vi.Mock).mockReturnValue({
      data: { evidence: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    expect(screen.getByText(/No evidence uploaded yet/i)).toBeInTheDocument();
  });

  it('opens upload modal when upload button is clicked', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const uploadButtons = screen.getAllByText('Upload Evidence');
    fireEvent.click(uploadButtons[0]);

    // Modal should open with heading
    expect(screen.getByRole('heading', { name: 'Upload Evidence' })).toBeInTheDocument();
  });

  it('allows searching evidence', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const searchInput = screen.getByPlaceholderText('Search evidence...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(searchInput).toHaveValue('test');
  });

  it('toggles filters panel', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    expect(screen.getByText('Evidence Type')).toBeInTheDocument();
  });

  it('handles verify evidence click', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const verifyButtons = screen.getAllByTitle('Verify Integrity');
    fireEvent.click(verifyButtons[0]);

    expect(mockVerifyMutation.mutate).toHaveBeenCalled();
  });

  it('handles download evidence click', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const downloadButtons = screen.getAllByTitle('Download');
    fireEvent.click(downloadButtons[0]);

    expect(mockDownloadMutation.mutate).toHaveBeenCalledWith('EVIDENCE-1');
  });

  it('handles delete evidence with confirmation', () => {
    window.confirm = vi.fn(() => true);
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutation.mutate).toHaveBeenCalled();
  });

  it('does not delete evidence when confirmation is cancelled', () => {
    window.confirm = vi.fn(() => false);
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutation.mutate).not.toHaveBeenCalled();
  });

  it('displays verified badge for verified evidence', () => {
    const verifiedEvidence = {
      ...mockEvidenceData,
      evidence: [
        {
          ...mockEvidenceData.evidence[0],
          verified: true,
          verification_date: '2023-01-02T00:00:00Z',
        },
      ],
    };

    (useCaseEvidence as vi.Mock).mockReturnValue({
      data: verifiedEvidence,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    expect(screen.getAllByTitle('Verified')).toHaveLength(1);
  });

  it('opens evidence details modal when evidence is clicked', () => {
    render(<EvidenceDocumentsTab caseId="CASE-123" />);

    const evidenceCard = screen.getByText('test.pdf').closest('.card');
    if (evidenceCard) {
      fireEvent.click(evidenceCard);
    }

    // Modal should open with heading
    expect(screen.getByRole('heading', { name: 'Evidence Details' })).toBeInTheDocument();
  });
});

