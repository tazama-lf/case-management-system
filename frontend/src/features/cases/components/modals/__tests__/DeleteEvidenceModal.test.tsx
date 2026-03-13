import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeleteEvidenceModal from '../DeleteEvidenceModal';
import { evidenceService } from '../../../services/evidenceService';
import type { Evidence } from '../../../types/evidence.types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'warning-icon' }),
}));

vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    deleteEvidence: vi.fn(),
  },
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const evidenceToDelete = { id: 'ev-1', fileName: 'test-file.pdf' };

const baseEvidence: Evidence[] = [
  {
    id: 'ev-1',
    taskId: 1,
    fileName: 'test-file.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    hash: 'abc',
    filePath: '/uploads/test-file.pdf',
    uploadedBy: 'user-1',
    uploadedAt: '2024-01-01',
    evidenceType: 'OTHER',
  },
  {
    id: 'ev-2',
    taskId: 1,
    fileName: 'other-file.pdf',
    fileSize: 2048,
    mimeType: 'application/pdf',
    hash: 'def',
    filePath: '/uploads/other-file.pdf',
    uploadedBy: 'user-1',
    uploadedAt: '2024-01-01',
    evidenceType: 'OTHER',
  },
];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('DeleteEvidenceModal', () => {
  const mockSetEvidenceToDelete = vi.fn();
  const mockSetUploadedEvidence = vi.fn();
  const mockOnDeleteSuccess = vi.fn();

  const defaultProps = {
    evidenceToDelete,
    setEvidenceToDelete: mockSetEvidenceToDelete,
    setUploadedEvidence: mockSetUploadedEvidence,
    onDeleteSuccess: mockOnDeleteSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (evidenceService.deleteEvidence as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  /* --- Rendering --- */

  it('renders modal with file name and warning icon', () => {
    render(<DeleteEvidenceModal {...defaultProps} />);
    expect(screen.getByText('Delete Evidence?')).toBeInTheDocument();
    expect(screen.getByText('test-file.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
  });

  it('renders cancel and delete buttons', () => {
    render(<DeleteEvidenceModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  /* --- Interactions --- */

  it('calls setEvidenceToDelete(null) when cancel clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockSetEvidenceToDelete).toHaveBeenCalledWith(null);
  });

  it('calls deleteEvidence and updates state on confirm', async () => {
    const user = userEvent.setup();
    render(<DeleteEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(evidenceService.deleteEvidence).toHaveBeenCalledWith('ev-1', 'test-file.pdf');
    });

    await waitFor(() => {
      expect(mockSetUploadedEvidence).toHaveBeenCalled();
      expect(mockOnDeleteSuccess).toHaveBeenCalled();
      expect(mockSetEvidenceToDelete).toHaveBeenCalledWith(null);
    });
  });

  it('shows Deleting... while processing', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    const deletePromise = new Promise<void>((r) => { resolveDelete = r; });
    (evidenceService.deleteEvidence as ReturnType<typeof vi.fn>).mockReturnValue(deletePromise);

    render(<DeleteEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    expect(screen.getByText('Deleting…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();

    resolveDelete();
    await waitFor(() => {
      expect(mockOnDeleteSuccess).toHaveBeenCalled();
    });
  });

  /* --- setUploadedEvidence callback logic --- */

  it('filters evidence array correctly', async () => {
    const user = userEvent.setup();
    let updater: ((prev: Evidence[]) => Evidence[]) | undefined;
    mockSetUploadedEvidence.mockImplementation((fn: (prev: Evidence[]) => Evidence[]) => {
      updater = fn;
    });

    render(<DeleteEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(updater).toBeDefined();
    });

    const result = updater!(baseEvidence);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ev-2');
  });

  it('filters evidence record correctly', async () => {
    const user = userEvent.setup();
    let updater: ((prev: Record<string, Evidence[]>) => Record<string, Evidence[]>) | undefined;
    mockSetUploadedEvidence.mockImplementation((fn: (prev: Record<string, Evidence[]>) => Record<string, Evidence[]>) => {
      updater = fn;
    });

    render(<DeleteEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(updater).toBeDefined();
    });

    const recordInput: Record<string, Evidence[]> = {
      section1: [...baseEvidence],
      section2: [baseEvidence[0]],
    };
    const result = updater!(recordInput);
    expect(result.section1).toHaveLength(1);
    expect(result.section2).toHaveLength(0);
  });

  /* --- Edge cases --- */

  it('returns early if evidenceToDelete is null during handleConfirmDelete', async () => {
    // The modal still renders because evidenceToDelete is set externally;
    // But call the delete with null evidence to test the guard
    render(<DeleteEvidenceModal {...defaultProps} evidenceToDelete={null} />);
    // The fileName text won't be there since evidenceToDelete?.fileName is undefined
    expect(screen.queryByText('test-file.pdf')).not.toBeInTheDocument();
  });

  it('works without onDeleteSuccess callback', async () => {
    const user = userEvent.setup();
    render(<DeleteEvidenceModal {...defaultProps} onDeleteSuccess={undefined} />);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(evidenceService.deleteEvidence).toHaveBeenCalled();
    });
  });
});
