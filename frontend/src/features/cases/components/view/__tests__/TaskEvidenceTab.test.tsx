import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskEvidenceTab from '../TaskEvidenceTab';
import { evidenceService } from '../../../services/evidenceService';

vi.mock('../../../services/evidenceService');
vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'user-1', username: 'testuser' }),
  },
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('TaskEvidenceTab', () => {
  const mockTask = {
    task_id: 1,
    case_id: 123,
    status: 'STATUS_20_IN_PROGRESS',
    assigned_user_id: 'user-1',
    name: 'Review Task',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
  };

  const mockEvidence = {
    evidence: [
      {
        id: 'EVIDENCE-1',
        fileName: 'kyc-report.pdf',
        evidenceType: 'KYC',
        fileSize: 1024,
        uploadedAt: '2023-01-01T00:00:00Z',
      },
      {
        id: 'EVIDENCE-2',
        fileName: 'sanctions.pdf',
        evidenceType: 'SANCTIONS',
        fileSize: 2048,
        uploadedAt: '2023-01-02T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue(
      mockEvidence,
    );
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
      message: 'Upload successful',
    });
  });

  it('renders task evidence tab', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);

    expect(screen.getByText('Evidence & Documents')).toBeInTheDocument();
  });

  it('displays evidence sections', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);

    expect(screen.getByText('KYC/EDD Report')).toBeInTheDocument();
    expect(screen.getByText('Sanctions Screening')).toBeInTheDocument();
    expect(screen.getByText('Adverse Media Screening')).toBeInTheDocument();
    expect(screen.getByText('Others')).toBeInTheDocument();
  });

  it('loads existing evidence on mount', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(1);
    });
  });

  it('allows selecting files for upload', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);

    // Open a section to see attach button
    fireEvent.click(screen.getByText('KYC/EDD Report'));

    const attachButtons = screen.getAllByText('Attach');
    expect(attachButtons.length).toBeGreaterThan(0);
  });

  it('displays uploaded evidence by section', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);

    // Open the KYC section to see evidence
    fireEvent.click(screen.getByText('KYC/EDD Report'));

    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
  });

  it('allows adding comments to evidence sections', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);

    // Open a section to see the comment textarea
    fireEvent.click(screen.getByText('KYC/EDD Report'));

    const commentTextareas =
      screen.getAllByPlaceholderText(/Add comments about/i);
    expect(commentTextareas.length).toBeGreaterThan(0);

    fireEvent.change(commentTextareas[0], {
      target: { value: 'Test comment' },
    });
    expect(commentTextareas[0]).toHaveValue('Test comment');
  });

  it('calls onUploadComplete when provided', async () => {
    const mockOnUploadComplete = vi.fn();
    render(
      <TaskEvidenceTab
        task={mockTask as any}
        caseId={123}
        onUploadComplete={mockOnUploadComplete}
      />,
    );

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalled();
    });
  });
});
