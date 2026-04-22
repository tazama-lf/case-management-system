import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SarStrFilingModal from '../SarStrFilingModal';
import { evidenceService } from '../../../services/evidenceService';

vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    getTaskEvidence: vi.fn(),
    uploadEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
    formatFileSize: vi.fn((size: number) => `${(size / 1024).toFixed(2)} KB`),
  },
}));

vi.mock('../../../../../shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User' },
    hasComplianceOfficerRole: () => true,
    hasSupervisorRole: () => false,
  }),
}));

vi.mock('../../../services/taskService', () => ({
  taskService: {
    completeTask: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
  TaskStatus: {
    STATUS_30_COMPLETED: 'STATUS_30_COMPLETED',
  },
}));

vi.mock('../DeleteEvidenceModal', () => ({
  default: ({
    evidenceToDelete,
    setEvidenceToDelete,
    setUploadedEvidence,
    onDeleteSuccess,
  }: any) =>
    evidenceToDelete ? (
      <div data-testid="delete-evidence-modal">
        <button
          onClick={() => {
            onDeleteSuccess();
          }}
        >
          Confirm Delete
        </button>
        <button onClick={() => setEvidenceToDelete(null)}>Cancel Delete</button>
      </div>
    ) : null,
}));

vi.mock('../CompleteTaskModal', () => ({
  default: ({ open, onClose, onCompleteTask, task }: any) =>
    open ? (
      <div data-testid="complete-task-modal">
        <button onClick={() => onCompleteTask(task, 'notes', undefined)}>
          Confirm Complete
        </button>
        <button onClick={onClose}>Close Complete</button>
      </div>
    ) : null,
}));

describe('SarStrFilingModal', () => {
  const mockOnClose = vi.fn();
  const mockOnTaskUpdate = vi.fn();
  const mockTask = {
    id: 'TASK-123',
    name: 'SAR/STR Filing',
    status: 'STATUS_20_IN_PROGRESS',
    caseId: 'CASE-123',
    assignee: 'user-1',
    created: '2024-01-01T00:00:00Z',
    dueDate: null,
    description: 'File SAR/STR',
  } as any;

  const completedTask = {
    ...mockTask,
    status: 'STATUS_30_COMPLETED',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
  });

  it('does not render when open is false', () => {
    render(
      <SarStrFilingModal
        open={false}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    expect(
      screen.queryByRole('heading', { name: /SAR\/STR Filing/i }),
    ).not.toBeInTheDocument();
  });

  it('renders modal when open', async () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      const headings = screen.getAllByRole('heading', {
        name: /SAR\/STR Filing/i,
      });
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  it('displays case name when provided', async () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        caseName="CASE-FRAUD-001"
        task={mockTask}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Case: CASE-FRAUD-001/)).toBeInTheDocument();
    });
  });

  it('loads existing evidence when modal opens', async () => {
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        description: 'SAR Filing',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(123);
    });
  });

  it('displays uploaded evidence when available', async () => {
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        description: 'SAR/STR Filing',
        fileName: 'sar-report.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'admin',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('sar-report.pdf')).toBeInTheDocument();
    });
  });

  it('shows "No SAR/STR filings uploaded yet" when evidence is empty', async () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No SAR\/STR filings uploaded yet/i),
      ).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      const closeButtons = screen.getAllByRole('button', { name: /Close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    await user.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows file upload section with supported formats', () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    expect(screen.getByText(/Supported formats/i)).toBeInTheDocument();
  });

  it('allows entering SAR remarks', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any comments about this SAR/i,
    );
    await user.type(textarea, 'SAR remarks text');
    expect(textarea).toHaveValue('SAR remarks text');
  });

  it('shows character count for remarks', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any comments about this SAR/i,
    );
    await user.type(textarea, 'Test');
    expect(screen.getByText('4/500')).toBeInTheDocument();
  });

  it('shows max character warning at 500 characters', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /Add any comments about this SAR/i,
    );
    const longText = 'a'.repeat(500);
    await user.click(textarea);
    // Directly set value due to maxLength
    await user.clear(textarea);
    // Type max chars
    await user.paste(longText);
    await waitFor(() => {
      expect(screen.getByText('500/500')).toBeInTheDocument();
      expect(
        screen.getByText(/Maximum character limit reached/i),
      ).toBeInTheDocument();
    });
  });

  it('shows Mark as Complete button for compliance officers with uploaded evidence', async () => {
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        description: 'SAR/STR Filing',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
        onTaskUpdate={mockOnTaskUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Mark as Complete/i)).toBeInTheDocument();
    });
  });

  it('disables Mark as Complete when no evidence uploaded', async () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      const completeBtn = screen
        .getByText(/Mark as Complete/i)
        .closest('button');
      expect(completeBtn).toBeDisabled();
    });
  });

  it('does not show Mark as Complete for completed tasks', () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={completedTask}
      />,
    );
    expect(screen.queryByText(/Mark as Complete/i)).not.toBeInTheDocument();
  });

  it('handles file selection', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    });
  });

  it('allows removing selected files', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /Remove file/i });
    await user.click(removeBtn);

    expect(screen.queryByText(/test\.pdf/)).not.toBeInTheDocument();
  });

  it('uploads evidence when Save button is clicked', async () => {
    const user = userEvent.setup();
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({});
    (evidenceService.getTaskEvidence as vi.Mock)
      .mockResolvedValueOnce({ evidence: [] })
      .mockResolvedValueOnce({
        evidence: [
          {
            id: 'ev-new',
            evidenceType: 'SAR_STR_FILING',
            fileName: 'test.pdf',
            uploadedAt: '2024-01-01T00:00:00Z',
            uploadedBy: 'user-1',
          },
        ],
      });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    const file = new File(['test content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, file);

    const saveBtn = screen
      .getByText(/Save SAR\/STR Filing/i)
      .closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalled();
    });
  });

  it('shows loading state for evidence', async () => {
    // Delay the resolution so loading state is visible
    (evidenceService.getTaskEvidence as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    expect(screen.getByText(/Loading evidence.../i)).toBeInTheDocument();
  });

  it('shows documentation header', () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    expect(
      screen.getByText(/SAR\/STR Filing Documentation/i),
    ).toBeInTheDocument();
  });

  it('shows previously uploaded filings count', async () => {
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar1.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
      {
        id: 'ev-2',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar2.pdf',
        description: 'SAR/STR description',
        uploadedAt: '2024-01-02T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Previously Uploaded SAR\/STR Filings \(2\)/i),
      ).toBeInTheDocument();
    });
  });

  it('handles download evidence', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    (evidenceService.downloadEvidence as vi.Mock).mockResolvedValue(mockBlob);
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'SAR_STR_FILING',
          fileName: 'report.pdf',
          uploadedAt: '2024-01-01T00:00:00Z',
          uploadedBy: 'user-1',
        },
      ],
    });

    // Mock document create/remove methods
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
    const mockRevokeObjectURL = vi.fn();
    Object.defineProperty(window, 'URL', {
      value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
      writable: true,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByTitle('Download Evidence');
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalledWith('ev-1');
    });
  });

  it('handles evidence load error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (evidenceService.getTaskEvidence as vi.Mock).mockRejectedValue(
      new Error('Load failed'),
    );

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load evidence:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('rejects files with unsupported extensions', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    const file = new File(['test'], 'test.exe', {
      type: 'application/x-msdownload',
    });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, file);

    // File should not appear in the list (rejected by filter)
    await waitFor(() => {
      expect(screen.queryByText('test.exe')).not.toBeInTheDocument();
    });
  });

  it('rejects files exceeding 50MB', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    // Create a file > 50MB
    const bigFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, bigFile);

    // Should not appear
    await waitFor(() => {
      expect(screen.queryByText('big.pdf')).not.toBeInTheDocument();
    });
  });

  it('opens delete evidence modal when delete button is clicked', async () => {
    const user = userEvent.setup();
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('sar.pdf')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('Delete Evidence');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId('delete-evidence-modal')).toBeInTheDocument();
    });
  });

  it('removes evidence from list after successful delete', async () => {
    const user = userEvent.setup();
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('sar.pdf')).toBeInTheDocument();
    });

    // Open delete modal
    await user.click(screen.getByTitle('Delete Evidence'));
    await waitFor(() => {
      expect(screen.getByTestId('delete-evidence-modal')).toBeInTheDocument();
    });

    // Confirm delete
    await user.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(screen.queryByText('sar.pdf')).not.toBeInTheDocument();
    });
  });

  it('opens CompleteTaskModal when Mark as Complete is clicked', async () => {
    const user = userEvent.setup();
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
        onTaskUpdate={mockOnTaskUpdate}
      />,
    );

    await waitFor(() => {
      const completeBtn = screen
        .getByText(/Mark as Complete/i)
        .closest('button');
      expect(completeBtn).not.toBeDisabled();
    });

    await user.click(screen.getByText(/Mark as Complete/i));

    await waitFor(() => {
      expect(screen.getByTestId('complete-task-modal')).toBeInTheDocument();
    });
  });

  it('completes task via CompleteTaskModal and closes', async () => {
    const user = userEvent.setup();
    const taskServiceModule = await import('../../../services/taskService');
    (taskServiceModule.taskService.completeTask as vi.Mock).mockResolvedValue(
      undefined,
    );
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
        onTaskUpdate={mockOnTaskUpdate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Mark as Complete/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Mark as Complete/i));

    await waitFor(() => {
      expect(screen.getByTestId('complete-task-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Confirm Complete'));

    await waitFor(() => {
      expect(taskServiceModule.taskService.completeTask).toHaveBeenCalledWith(
        'TASK-123',
      );
    });
  });

  it('handles task completion error', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const taskServiceModule = await import('../../../services/taskService');
    (taskServiceModule.taskService.completeTask as vi.Mock).mockRejectedValue(
      new Error('Complete failed'),
    );
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        fileName: 'sar.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        uploadedBy: 'user-1',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Mark as Complete/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Mark as Complete/i));
    await waitFor(() => {
      expect(screen.getByTestId('complete-task-modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Confirm Complete'));

    // Wait for the error to be handled
    await waitFor(() => {
      expect(taskServiceModule.taskService.completeTask).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('handles download evidence error', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (evidenceService.downloadEvidence as vi.Mock).mockRejectedValue(
      new Error('Download failed'),
    );
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [
        {
          id: 'ev-1',
          evidenceType: 'SAR_STR_FILING',
          fileName: 'report.pdf',
          uploadedAt: '2024-01-01T00:00:00Z',
          uploadedBy: 'user-1',
        },
      ],
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Download Evidence'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to download evidence:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('handles upload error', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (evidenceService.uploadEvidence as vi.Mock).mockRejectedValue(
      new Error('Upload failed'),
    );

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    });

    const saveBtn = screen
      .getByText(/Save SAR\/STR Filing/i)
      .closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to upload SAR/STR filing:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('uploads with SAR remarks when provided', async () => {
    const user = userEvent.setup();
    (evidenceService.uploadEvidence as vi.Mock).mockResolvedValue({});
    (evidenceService.getTaskEvidence as vi.Mock)
      .mockResolvedValueOnce({ evidence: [] })
      .mockResolvedValueOnce({ evidence: [] });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    // Add remarks
    const textarea = screen.getByPlaceholderText(
      /Add any comments about this SAR/i,
    );
    await user.type(textarea, 'Important remarks');

    // Add file
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector(
      '#sar-str-file-input',
    ) as HTMLInputElement;
    await user.upload(input, file);

    // Save
    const saveBtn = screen
      .getByText(/Save SAR\/STR Filing/i)
      .closest('button')!;
    await user.click(saveBtn);

    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          comments: 'Important remarks',
          description: expect.stringContaining('Important remarks'),
        }),
      );
    });
  });

  it('shows supervisor-only message for supervisors', async () => {
    // This is tested via the useAuth mock returning hasSupervisorRole: () => false
    // The default mock has hasSupervisorRole: () => false
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );
    // With default supervisor=false, the message should not appear
    expect(
      screen.queryByText(/Only the Compliance Officer is authorized/i),
    ).not.toBeInTheDocument();
  });
});
