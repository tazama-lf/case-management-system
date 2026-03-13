import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskEvidenceTab from '../TaskEvidenceTab';
import { evidenceService } from '../../../services/evidenceService';
import type { TaskForSupervisor } from '../../../services/taskService';

vi.mock('../../../services/evidenceService');

const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('@/features/auth/services/authService', () => ({
  default: {
    getUser: vi.fn().mockReturnValue({ userId: 'user-1', username: 'jdoe' }),
  },
}));
vi.mock('../../../../../shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));
vi.mock('../../../../../shared/utils/dateUtils', () => ({
  formatDate: (d: string) => d ?? 'N/A',
}));

let capturedDeleteProps: Record<string, unknown> = {};
vi.mock('../../modals/DeleteEvidenceModal', () => ({
  default: (props: Record<string, unknown>) => {
    capturedDeleteProps = props;
    return props.evidenceToDelete ? <div data-testid="delete-modal">Delete Modal</div> : null;
  },
}));

let capturedConfirmProps: Record<string, unknown> = {};
vi.mock('../../modals/ConfirmUploadEvidenceModal', () => ({
  default: (props: Record<string, unknown>) => {
    capturedConfirmProps = props;
    return props.isOpen ? (
      <div data-testid="confirm-upload-modal">
        <button data-testid="confirm-btn" onClick={props.onConfirm as () => void}>Confirm</button>
        <button data-testid="cancel-btn" onClick={props.onCancel as () => void}>Cancel</button>
      </div>
    ) : null;
  },
}));

describe('TaskEvidenceTab', () => {
  const mockTask: TaskForSupervisor = {
    task_id: 1,
    name: 'Investigate Case',
    status: 'STATUS_20_IN_PROGRESS',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    case_id: 123,
    assigned_user_id: 'user-1',
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
        fileName: 'other-doc.pdf',
        evidenceType: 'OTHER',
        fileSize: 4096,
        uploadedAt: '2023-01-04T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedDeleteProps = {};
    capturedConfirmProps = {};
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvidence);
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      message: 'Upload successful',
    });
  });

  it('renders task evidence tab with all sections', () => {
    render(<TaskEvidenceTab task={mockTask} />);
    expect(screen.getByText('Evidence & Documents')).toBeInTheDocument();
    expect(screen.getByText('KYC/EDD Report')).toBeInTheDocument();
    expect(screen.getByText('Sanctions Screening')).toBeInTheDocument();
    expect(screen.getByText('Adverse Media Screening')).toBeInTheDocument();
    expect(screen.getByText('Others')).toBeInTheDocument();
  });

  it('loads existing evidence on mount', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(1);
    });
  });

  it('does not load evidence when task has no task_id', async () => {
    const noIdTask = { ...mockTask, task_id: undefined as unknown as number };
    render(<TaskEvidenceTab task={noIdTask} />);
    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).not.toHaveBeenCalled();
    });
  });

  it('shows attach buttons and comments when section is expanded', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));

    expect(screen.getByText('Attach')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add comments about the KYC/EDD report...')).toBeInTheDocument();
    expect(screen.getByText('No files pending')).toBeInTheDocument();
  });

  it('collapses section on second click (toggle)', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    const section = screen.getByText('KYC/EDD Report');
    fireEvent.click(section);
    expect(screen.getByText('No files pending')).toBeInTheDocument();

    fireEvent.click(section);
    expect(screen.queryByText('No files pending')).not.toBeInTheDocument();
  });

  it('allows adding and clearing comments', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText('Add comments about the KYC/EDD report...');
    fireEvent.change(textarea, { target: { value: 'Test comment' } });
    expect(textarea).toHaveValue('Test comment');
  });

  it('shows character count limit message at 500 chars', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText('Add comments about the KYC/EDD report...');
    const longComment = 'a'.repeat(500);
    fireEvent.change(textarea, { target: { value: longComment } });

    expect(screen.getByText('500/500')).toBeInTheDocument();
    expect(screen.getByText('Maximum character limit reached')).toBeInTheDocument();
  });

  it('shows normal comment helper text when under limit', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    expect(screen.getByText('Comments help with case investigation and audit trails')).toBeInTheDocument();
  });

  it('displays uploaded evidence grouped by type', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument());
    expect(screen.getByText('Uploaded Evidence (1)')).toBeInTheDocument();
  });

  it('groups EDD evidence under kyc-edd section', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: [{ id: 'E-1', fileName: 'edd.pdf', evidenceType: 'EDD', fileSize: 100, uploadedAt: '2023-01-01' }],
    });
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => expect(screen.getByText('edd.pdf')).toBeInTheDocument());
  });

  it('has Upload Evidence button disabled when no files pending', () => {
    render(<TaskEvidenceTab task={mockTask} />);
    expect(screen.getByText('Upload Evidence')).toBeDisabled();
  });

  it('handles file selection with valid file type', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText('Ready to upload')).toBeInTheDocument();
    });
  });

  it('rejects file with invalid type', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('File type not allowed'));
  });

  it('handles empty file list gracefully', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });

    expect(screen.getByText('No files pending')).toBeInTheDocument();
  });

  it('rejects files exceeding max per section', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: [
        { id: 'E-1', fileName: 'a.pdf', evidenceType: 'KYC', fileSize: 100, uploadedAt: '2023-01-01' },
        { id: 'E-2', fileName: 'b.pdf', evidenceType: 'KYC', fileSize: 100, uploadedAt: '2023-01-01' },
        { id: 'E-3', fileName: 'c.pdf', evidenceType: 'KYC', fileSize: 100, uploadedAt: '2023-01-01' },
        { id: 'E-4', fileName: 'd.pdf', evidenceType: 'KYC', fileSize: 100, uploadedAt: '2023-01-01' },
        { id: 'E-5', fileName: 'e.pdf', evidenceType: 'KYC', fileSize: 100, uploadedAt: '2023-01-01' },
      ],
    });
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'extra.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Maximum'));
  });

  it('removes a pending file when X is clicked', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => expect(screen.getByText('Ready to upload')).toBeInTheDocument());

    const removeBtn = screen.getByTitle('Remove Upload');
    fireEvent.click(removeBtn);

    await waitFor(() => expect(screen.getByText('No files pending')).toBeInTheDocument());
  });

  it('enables Upload Evidence button when files are pending', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText('Upload Evidence')).not.toBeDisabled();
    });
  });

  it('opens confirm upload modal when Upload Evidence is clicked', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => expect(screen.getByText('Upload Evidence')).not.toBeDisabled());

    fireEvent.click(screen.getByText('Upload Evidence'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-upload-modal')).toBeInTheDocument();
    });
  });

  it('uploads evidence on confirm and shows success toast', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => expect(screen.getByText('Upload Evidence')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Upload Evidence'));

    await waitFor(() => expect(screen.getByTestId('confirm-upload-modal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-btn'));
    });

    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalledWith('Evidence uploaded successfully');
    });
  });

  it('shows error toast when upload fails', async () => {
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Upload failed'));

    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => expect(screen.getByTestId('confirm-upload-modal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-btn'));
    });

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Failed to upload evidence.');
    });
  });

  it('cancels confirm upload modal', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => expect(screen.getByTestId('confirm-upload-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('cancel-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-upload-modal')).not.toBeInTheDocument();
    });
  });

  it('triggers delete modal when trash icon is clicked on uploaded evidence', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument());

    const deleteBtn = screen.getByTitle('Delete Evidence');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });
  });

  it('disables controls when task is completed', async () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    render(<TaskEvidenceTab task={completedTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    expect(screen.getByText('Upload Evidence')).toBeDisabled();

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const textarea = screen.getByPlaceholderText('Add comments about the KYC/EDD report...');
    expect(textarea).toBeDisabled();
  });

  it('disables controls when task is blocked', async () => {
    const blockedTask = { ...mockTask, status: 'STATUS_21_BLOCKED' };
    render(<TaskEvidenceTab task={blockedTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    expect(screen.getByText('Upload Evidence')).toBeDisabled();
  });

  it('disables controls when different user is assigned', async () => {
    const otherUserTask = { ...mockTask, assigned_user_id: 'other-user' };
    render(<TaskEvidenceTab task={otherUserTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    expect(screen.getByText('Upload Evidence')).toBeDisabled();
  });

  it('calls onSaveRequest with upload function', async () => {
    const onSaveRequest = vi.fn();
    render(<TaskEvidenceTab task={mockTask} onSaveRequest={onSaveRequest} />);
    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalled();
    });
    expect(typeof onSaveRequest.mock.calls[0][0]).toBe('function');
  });

  it('calls onUploadComplete after successful upload', async () => {
    const onUploadComplete = vi.fn();
    render(<TaskEvidenceTab task={mockTask} onUploadComplete={onUploadComplete} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    fireEvent.click(screen.getByText('Upload Evidence'));
    await waitFor(() => expect(screen.getByTestId('confirm-upload-modal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-btn'));
    });

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled();
    });
  });

  it('handles load evidence failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());
    expect(screen.getByText('Evidence & Documents')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('displays file size formatted correctly for uploaded evidence', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: [
        { id: 'E-1', fileName: 'big.pdf', evidenceType: 'KYC', fileSize: 0, uploadedAt: '2023-01-01' },
      ],
    });
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => expect(screen.getByText('big.pdf')).toBeInTheDocument());
  });

  it('hides delete button for uploaded evidence when task is completed', async () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    render(<TaskEvidenceTab task={completedTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument());

    // Delete button should be hidden (via hidden attribute)
    const deleteBtn = screen.getByTitle('Delete Evidence');
    expect(deleteBtn).toHaveAttribute('hidden');
  });

  it('clicks file input when Attach button is clicked', async () => {
    render(<TaskEvidenceTab task={mockTask} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const attachBtn = screen.getByText('Attach');
    fireEvent.click(attachBtn);

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('calls onUploadComplete and reloads evidence on delete success', async () => {
    const onUploadComplete = vi.fn();
    render(<TaskEvidenceTab task={mockTask} onUploadComplete={onUploadComplete} />);
    await waitFor(() => expect(evidenceService.getTaskEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByText('KYC/EDD Report'));
    await waitFor(() => expect(screen.getByText('kyc-report.pdf')).toBeInTheDocument());

    const deleteBtn = screen.getByTitle('Delete Evidence');
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(screen.getByTestId('delete-modal')).toBeInTheDocument());

    // Clear the initial load call count
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockClear();

    // Invoke the onDeleteSuccess callback captured from the mock
    await act(async () => {
      (capturedDeleteProps.onDeleteSuccess as () => void)();
    });

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(1);
    });
    expect(onUploadComplete).toHaveBeenCalled();
  });
});
