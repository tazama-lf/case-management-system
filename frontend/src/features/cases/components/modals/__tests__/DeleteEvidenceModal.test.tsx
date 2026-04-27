import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeleteEvidenceModal from '../DeleteEvidenceModal';

const mockDeleteEvidence = vi.fn();
vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    deleteEvidence: (...args: any[]) => mockDeleteEvidence(...args),
  },
}));

describe('DeleteEvidenceModal', () => {
  const setEvidenceToDelete = vi.fn();
  const setUploadedEvidence = vi.fn();
  const onDeleteSuccess = vi.fn();

  const defaultProps = {
    evidenceToDelete: { id: 'ev-1', fileName: 'report.pdf' },
    setEvidenceToDelete,
    setUploadedEvidence,
    onDeleteSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders delete confirmation', () => {
    render(<DeleteEvidenceModal {...defaultProps} />);
    expect(screen.getByText('Delete Evidence?')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('calls setEvidenceToDelete(null) on cancel', () => {
    render(<DeleteEvidenceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(setEvidenceToDelete).toHaveBeenCalledWith(null);
  });

  it('deletes evidence on confirm with array state', async () => {
    mockDeleteEvidence.mockResolvedValue(undefined);
    const mockSetEvidence = vi.fn();
    render(
      <DeleteEvidenceModal
        {...defaultProps}
        setUploadedEvidence={mockSetEvidence}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteEvidence).toHaveBeenCalledWith('ev-1', 'report.pdf');
    });
    await waitFor(() => {
      expect(mockSetEvidence).toHaveBeenCalled();
    });
  });

  it('calls onDeleteSuccess after deletion', async () => {
    mockDeleteEvidence.mockResolvedValue(undefined);
    render(<DeleteEvidenceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(onDeleteSuccess).toHaveBeenCalled();
    });
  });
});
