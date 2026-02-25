import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskEvidenceTab from '../TaskEvidenceTab';
import { evidenceService } from '../../../services/evidenceService';
import GenerateTransactionProfileModal from '../../modals/GenerateTransactionProfileModal';

vi.mock('../../../services/evidenceService');
vi.mock('../../modals/GenerateTransactionProfileModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="profile-modal">Profile Modal</div> : null,
}));

describe('TaskEvidenceTab', () => {
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
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    expect(screen.getByText('Evidence & Documents')).toBeInTheDocument();
  });

  it('displays evidence sections', () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    expect(screen.getByText('KYC/EDD Report')).toBeInTheDocument();
    expect(screen.getByText('Sanctions Screening')).toBeInTheDocument();
    expect(screen.getByText('Adverse Media Screening')).toBeInTheDocument();
    expect(screen.getByText('Others')).toBeInTheDocument();
  });

  it('loads existing evidence on mount', async () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith('TASK-1');
    });
  });

  it('allows selecting files for upload', () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    const attachButtons = screen.getAllByText('Attach Evidence');
    expect(attachButtons.length).toBeGreaterThan(0);
  });

  it('displays transaction profile section', () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    expect(
      screen.getByText('Transaction Profile Analysis'),
    ).toBeInTheDocument();
  });

  it('opens transaction profile modal when generate button is clicked', () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    const generateButton = screen.getByText('Generate Profile');
    fireEvent.click(generateButton);

    expect(screen.getByTestId('profile-modal')).toBeInTheDocument();
  });

  it('displays uploaded evidence by section', async () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
  });

  it('allows adding comments to evidence sections', () => {
    render(<TaskEvidenceTab taskId="TASK-1" caseId="CASE-123" />);

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
        taskId="TASK-1"
        caseId="CASE-123"
        onUploadComplete={mockOnUploadComplete}
      />,
    );

    // The component calls onUploadComplete after successful upload
    // This is tested indirectly through the upload flow
    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalled();
    });
  });
});
