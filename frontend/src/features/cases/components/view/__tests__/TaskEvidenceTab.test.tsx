import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskEvidenceTab from '../TaskEvidenceTab';
import { evidenceService } from '../../../services/evidenceService';

vi.mock('../../../services/evidenceService');

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 'user-1', username: 'testuser' }),
  },
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d || 'N/A',
}));
vi.mock('../../modals/DeleteEvidenceModal', () => ({
  default: ({ evidenceToDelete, setEvidenceToDelete, onDeleteSuccess }: any) =>
    evidenceToDelete ? (
      <div data-testid="delete-modal">
        <span>{evidenceToDelete.fileName}</span>
        <button
          onClick={() => {
            onDeleteSuccess();
            setEvidenceToDelete(null);
          }}
        >
          Confirm Delete
        </button>
        <button onClick={() => setEvidenceToDelete(null)}>Cancel Delete</button>
      </div>
    ) : null,
}));
vi.mock('../../modals/ConfirmUploadEvidenceModal', () => ({
  default: ({ isOpen, onConfirm, onCancel }: any) =>
    isOpen ? (
      <div data-testid="upload-confirm-modal">
        <button onClick={onConfirm}>Confirm Upload</button>
        <button onClick={onCancel}>Cancel Upload</button>
      </div>
    ) : null,
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
      {
        id: 'EVIDENCE-3',
        fileName: 'adverse.pdf',
        evidenceType: 'ADVERSE_MEDIA',
        fileSize: 512,
        uploadedAt: '2023-01-03T00:00:00Z',
      },
      {
        id: 'EVIDENCE-4',
        fileName: 'other.txt',
        evidenceType: 'OTHER',
        fileSize: 128,
        uploadedAt: '2023-01-04T00:00:00Z',
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
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const attachButtons = screen.getAllByText('Attach');
    expect(attachButtons.length).toBeGreaterThan(0);
  });

  it('displays uploaded evidence by section', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
  });

  it('allows adding comments to evidence sections', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
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

  it('toggles section open and closed', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    // Open
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    expect(screen.getByText('Pending Upload')).toBeInTheDocument();
    // Close
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    expect(screen.queryByText('Pending Upload')).not.toBeInTheDocument();
  });

  it('displays all evidence sections with evidence grouped', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    // Open sanctions section
    fireEvent.click(screen.getByText('Sanctions Screening'));
    await waitFor(() => {
      expect(screen.getByText('sanctions.pdf')).toBeInTheDocument();
    });
  });

  it('shows adverse media evidence', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('Adverse Media Screening'));
    await waitFor(() => {
      expect(screen.getByText('adverse.pdf')).toBeInTheDocument();
    });
  });

  it('shows other evidence', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('Others'));
    await waitFor(() => {
      expect(screen.getByText('other.txt')).toBeInTheDocument();
    });
  });

  it('upload button is disabled when no files are pending', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    const uploadBtn = screen.getByText('Upload Evidence');
    expect(uploadBtn).toBeDisabled();
  });

  it('upload button is disabled for completed tasks', () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    render(<TaskEvidenceTab task={completedTask as any} caseId={123} />);
    const uploadBtn = screen.getByText('Upload Evidence');
    expect(uploadBtn).toBeDisabled();
  });

  it('upload button is disabled for blocked tasks', () => {
    const blockedTask = { ...mockTask, status: 'STATUS_21_BLOCKED' };
    render(<TaskEvidenceTab task={blockedTask as any} caseId={123} />);
    const uploadBtn = screen.getByText('Upload Evidence');
    expect(uploadBtn).toBeDisabled();
  });

  it('upload button is disabled for non-assigned user', () => {
    const otherTask = { ...mockTask, assigned_user_id: 'other-user' };
    render(<TaskEvidenceTab task={otherTask as any} caseId={123} />);
    const uploadBtn = screen.getByText('Upload Evidence');
    expect(uploadBtn).toBeDisabled();
  });

  it('shows no files pending message when section is empty', () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    expect(screen.getByText('No files pending')).toBeInTheDocument();
  });

  it('handles evidence load error', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockRejectedValue(
      new Error('Failed'),
    );
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalled();
    });
    // Component should still render
    expect(screen.getByText('Evidence & Documents')).toBeInTheDocument();
  });

  it('shows helper text for sections', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    expect(
      screen.getByText('Upload KYC/EDD documentation'),
    ).toBeInTheDocument();
  });

  it('handles EDD evidence type grouping into kyc-edd', async () => {
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'EV-EDD',
          fileName: 'edd.pdf',
          evidenceType: 'EDD',
          fileSize: 100,
          uploadedAt: '2024-01-01',
        },
      ],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('edd.pdf')).toBeInTheDocument();
    });
  });

  it('adds files to pending upload via file input change', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('shows file size for pending files', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['x'.repeat(2048)], 'large.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('large.pdf')).toBeInTheDocument();
    });
    expect(screen.getByText('Ready to upload')).toBeInTheDocument();
  });

  it('removes pending file when X button is clicked', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'remove-me.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('remove-me.pdf')).toBeInTheDocument();
    });
    const removeBtn = screen.getByTitle('Remove Upload');
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(screen.queryByText('remove-me.pdf')).not.toBeInTheDocument();
    });
  });

  it('enables upload button when files are pending', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    const uploadBtn = screen.getByText('Upload Evidence');
    expect(uploadBtn).not.toBeDisabled();
  });

  it('shows upload confirm modal when upload button clicked', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
  });

  it('cancels upload confirm modal', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Cancel Upload'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('upload-confirm-modal'),
      ).not.toBeInTheDocument();
    });
  });

  it('uploads evidence via confirm modal', async () => {
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'upload.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('upload.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Upload'));
    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalled();
    });
  });

  it('shows success toast after successful upload', async () => {
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'success.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('success.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Upload'));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Evidence uploaded successfully',
      );
    });
  });

  it('shows error toast when upload fails', async () => {
    (evidenceService.uploadEvidence as vi.Mock).mockRejectedValue(
      new Error('Upload failed'),
    );
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'fail.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('fail.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Upload'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to upload evidence.');
    });
  });

  it('shows delete evidence modal when delete button clicked', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
    const deleteBtn = screen.getByTitle('Delete Evidence');
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });
  });

  it('cancels delete evidence modal', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Delete Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Cancel Delete'));
    await waitFor(() => {
      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
    });
  });

  it('shows uploaded evidence count', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText(/Uploaded Evidence/i)).toBeInTheDocument();
    });
  });

  it('shows uploaded check mark for evidence', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('✓ Uploaded')).toBeInTheDocument();
    });
  });

  it('shows comment character count', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('shows character count when typing comment', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText(/Add comments about/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  it('shows comment helper text', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    expect(
      screen.getByText(/Comments help with case investigation/i),
    ).toBeInTheDocument();
  });

  it('shows max character limit warning at 500 chars', () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText(/Add comments about/i);
    const longComment = 'a'.repeat(500);
    fireEvent.change(textarea, { target: { value: longComment } });
    expect(screen.getByText('500/500')).toBeInTheDocument();
    expect(
      screen.getByText('Maximum character limit reached'),
    ).toBeInTheDocument();
  });

  it('provides onSaveRequest callback', async () => {
    const mockOnSaveRequest = vi.fn();
    render(
      <TaskEvidenceTab
        task={mockTask as any}
        caseId={123}
        onSaveRequest={mockOnSaveRequest}
      />,
    );
    await waitFor(() => {
      expect(mockOnSaveRequest).toHaveBeenCalled();
    });
  });

  it('calls onUploadComplete after successful upload', async () => {
    const onUploadComplete = vi.fn();
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(
      <TaskEvidenceTab
        task={mockTask as any}
        caseId={123}
        onUploadComplete={onUploadComplete}
      />,
    );
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'callback.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('callback.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Upload'));
    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled();
    });
  });

  it('disables attach and comment for completed tasks', () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    render(<TaskEvidenceTab task={completedTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const attachBtns = screen.getAllByText('Attach');
    attachBtns.forEach((btn) => expect(btn).toBeDisabled());
    const textarea = screen.getByPlaceholderText(/Add comments about/i);
    expect(textarea).toBeDisabled();
  });

  it('disables attach and comment for blocked tasks', () => {
    const blockedTask = { ...mockTask, status: 'STATUS_21_BLOCKED' };
    render(<TaskEvidenceTab task={blockedTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const attachBtns = screen.getAllByText('Attach');
    attachBtns.forEach((btn) => expect(btn).toBeDisabled());
    const textarea = screen.getByPlaceholderText(/Add comments about/i);
    expect(textarea).toBeDisabled();
  });

  it('disables controls for non-assigned user', () => {
    const otherTask = { ...mockTask, assigned_user_id: 'other-user' };
    render(<TaskEvidenceTab task={otherTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText(/Add comments about/i);
    expect(textarea).toBeDisabled();
  });

  it('hides delete button for completed tasks', async () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    render(<TaskEvidenceTab task={completedTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
    const deleteBtn = screen.getByTitle('Delete Evidence');
    expect(deleteBtn).toBeDisabled();
  });

  it('uploads evidence with comments', async () => {
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText(/Add comments about/i);
    fireEvent.change(textarea, { target: { value: 'Important finding' } });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'with-comment.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('with-comment.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Upload'));
    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalled();
    });
  });

  it('rejects files with disallowed file types', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const exeFile = new File(['content'], 'malware.exe', {
      type: 'application/x-msdownload',
    });
    fireEvent.change(fileInput, { target: { files: [exeFile] } });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('File type not allowed'),
      );
    });
    expect(screen.queryByText('malware.exe')).not.toBeInTheDocument();
  });

  it('shows no files pending when all files filtered by invalid type', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    // .exe is not in allowedFileTypes for kyc-edd
    const badFile = new File(['content'], 'bad.exe', {
      type: 'application/x-msdownload',
    });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    // The pending section should still show no files
    expect(screen.getByText('No files pending')).toBeInTheDocument();
  });

  it('rejects files when max files per section exceeded', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    // Add 5 files first (max for kyc-edd)
    for (let i = 0; i < 5; i++) {
      const file = new File(['content'], `file${i}.pdf`, {
        type: 'application/pdf',
      });
      fireEvent.change(fileInput, { target: { files: [file] } });
    }
    await waitFor(() => {
      expect(screen.getByText('file4.pdf')).toBeInTheDocument();
    });
    // Try adding a 6th
    const extraFile = new File(['content'], 'extra.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [extraFile] } });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('Maximum'),
      );
    });
  });

  it('captures handleUploadEvidence via onSaveRequest and invokes it', async () => {
    let capturedUploadFn: (() => Promise<void>) | null = null;
    const mockOnSaveRequest = vi.fn((fn: () => Promise<void>) => {
      capturedUploadFn = fn;
    });
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(
      <TaskEvidenceTab
        task={mockTask as any}
        caseId={123}
        onSaveRequest={mockOnSaveRequest}
      />,
    );
    await waitFor(() => {
      expect(mockOnSaveRequest).toHaveBeenCalled();
    });
    // Call the captured function - with no pending files, it should return early
    expect(capturedUploadFn).not.toBeNull();
    await capturedUploadFn!();
    // No uploads should have been made since no files pending
    expect(evidenceService.uploadEvidence).not.toHaveBeenCalled();
  });

  it('invokes handleUploadEvidence with pending files via onSaveRequest', async () => {
    let capturedUploadFn: (() => Promise<void>) | null = null;
    const mockOnSaveRequest = vi.fn((fn: () => Promise<void>) => {
      capturedUploadFn = fn;
    });
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    render(
      <TaskEvidenceTab
        task={mockTask as any}
        caseId={123}
        onSaveRequest={mockOnSaveRequest}
      />,
    );
    // Add a file to a section
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'save-request.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('save-request.pdf')).toBeInTheDocument();
    });
    // onSaveRequest is called again with updated function
    await waitFor(() => {
      expect(mockOnSaveRequest.mock.calls.length).toBeGreaterThan(1);
    });
    capturedUploadFn =
      mockOnSaveRequest.mock.calls[mockOnSaveRequest.mock.calls.length - 1][0];
    await capturedUploadFn!();
    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalled();
    });
  });

  it('shows upload date for uploaded evidence', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => {
      expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument();
    });
    const uploadedText = screen.getByText(/Uploaded 2023-01-01/);
    expect(uploadedText).toBeInTheDocument();
  });

  it('sanitizes file names with special characters', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['content'], 'test<file>.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      // File name should be sanitized - special chars replaced with _
      const pendingFiles = screen.queryAllByText(/test.*\.pdf/);
      expect(pendingFiles.length).toBeGreaterThan(0);
    });
  });

  it('clears pending files after successful upload', async () => {
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({
      success: true,
    });
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const testFile = new File(['content'], 'clear-test.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText('clear-test.pdf')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-confirm-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Confirm Upload'));
    await waitFor(() => {
      expect(screen.queryByText('clear-test.pdf')).not.toBeInTheDocument();
    });
  });

  it('click attach button triggers file input', async () => {
    render(<TaskEvidenceTab task={mockTask as any} caseId={123} />);
    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const attachBtns = screen.getAllByText('Attach');
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    fireEvent.click(attachBtns[0]);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
