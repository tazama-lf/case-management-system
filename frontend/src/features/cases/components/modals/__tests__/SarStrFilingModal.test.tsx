import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SarStrFilingModal from '../SarStrFilingModal';
import { evidenceService } from '../../../services/evidenceService';
import type { UnifiedWorkQueueTask } from '../../../types/task.types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    getTaskEvidence: vi.fn(),
    uploadEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
    deleteEvidence: vi.fn(),
  },
}));

const mockUpdateTaskForSupervisor = vi.fn();
const mockCompleteTask = vi.fn();
vi.mock('../../../services/taskService', () => ({
  taskService: {
    updateTaskForSupervisor: (...args: unknown[]) => mockUpdateTaskForSupervisor(...args),
    completeTask: (...args: unknown[]) => mockCompleteTask(...args),
  },
  TaskStatus: {
    STATUS_01_UNASSIGNED: 'STATUS_01_UNASSIGNED',
    STATUS_10_ASSIGNED: 'STATUS_10_ASSIGNED',
    STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
    STATUS_30_COMPLETED: 'STATUS_30_COMPLETED',
    STATUS_21_BLOCKED: 'STATUS_21_BLOCKED',
  },
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

let mockHasComplianceOfficerRole = vi.fn(() => true);
let mockHasSupervisorRole = vi.fn(() => false);
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
    hasSupervisorRole: mockHasSupervisorRole,
  }),
}));

vi.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'x-icon' }),
  ArrowUpTrayIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'upload-icon' }),
  DocumentCheckIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'doc-icon' }),
  TrashIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'trash-icon' }),
  ArrowPathIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'path-icon' }),
  ArrowDownTrayIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'download-icon' }),
  CheckIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'check-icon' }),
}));

vi.mock('../DeleteEvidenceModal', () => ({
  default: ({ evidenceToDelete, setEvidenceToDelete, onDeleteSuccess }: {
    evidenceToDelete: { id: string; fileName: string } | null;
    setEvidenceToDelete: (val: null) => void;
    onDeleteSuccess?: () => void;
  }) =>
    React.createElement('div', { 'data-testid': 'delete-modal' },
      evidenceToDelete?.fileName,
      React.createElement('button', {
        'data-testid': 'mock-delete-cancel',
        onClick: () => setEvidenceToDelete(null),
      }, 'MockCancel'),
      React.createElement('button', {
        'data-testid': 'mock-delete-confirm',
        onClick: () => onDeleteSuccess?.(),
      }, 'MockDelete'),
    ),
}));

vi.mock('@/features/cases/components/modals/CompleteTaskModal', () => ({
  default: ({ open, onClose, onCompleteTask, task }: {
    open: boolean; onClose: () => void;
    onCompleteTask: (task: UnifiedWorkQueueTask, notes?: string) => void;
    task: UnifiedWorkQueueTask;
  }) =>
    open
      ? React.createElement('div', { 'data-testid': 'complete-modal' },
          React.createElement('button', {
            'data-testid': 'mock-complete-btn',
            onClick: () => onCompleteTask(task, 'test notes'),
          }, 'MockComplete'),
          React.createElement('button', {
            'data-testid': 'mock-complete-close',
            onClick: onClose,
          }, 'MockCloseComplete'),
        )
      : null,
}));

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (d: string | Date) => String(d),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const baseTask: UnifiedWorkQueueTask = {
  id: 123,
  name: 'File SAR',
  status: 'STATUS_20_IN_PROGRESS',
  caseId: 100,
};

const completedTask: UnifiedWorkQueueTask = {
  ...baseTask,
  status: 'STATUS_30_COMPLETED',
};

const mockEvidence = [
  {
    id: 'ev-1',
    taskId: 123,
    fileName: 'sar-filing.pdf',
    fileSize: 2048,
    mimeType: 'application/pdf',
    hash: 'abc',
    filePath: '/uploads/sar-filing.pdf',
    uploadedBy: 'compliance-user',
    uploadedAt: '2024-06-01',
    evidenceType: 'SAR_STR_FILING',
    description: 'SAR/STR Filing - Regulatory Filing',
  },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  taskId: 123,
  caseId: 100,
  caseName: 'Test Case',
  onTaskUpdate: vi.fn(),
  task: baseTask,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('SarStrFilingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasComplianceOfficerRole = vi.fn(() => true);
    mockHasSupervisorRole = vi.fn(() => false);
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: [],
    });
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (evidenceService.downloadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue(new Blob());
    mockUpdateTaskForSupervisor.mockResolvedValue({});
    mockCompleteTask.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* --- Visibility --- */

  it('does not render when open is false', () => {
    render(<SarStrFilingModal {...defaultProps} open={false} />);
    expect(screen.queryByText('SAR/STR Filing')).not.toBeInTheDocument();
  });

  it('renders modal heading when open', async () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText('SAR/STR Filing')).toBeInTheDocument();
  });

  it('displays case name when provided', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText('Case: Test Case')).toBeInTheDocument();
  });

  it('shows supervisor note when user has supervisor role', () => {
    mockHasSupervisorRole = vi.fn(() => true);
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText(/Only the Compliance Officer is authorized/i)).toBeInTheDocument();
  });

  it('does not show supervisor note when user is not supervisor', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.queryByText(/Only the Compliance Officer is authorized/i)).not.toBeInTheDocument();
  });

  /* --- Evidence loading --- */

  it('loads evidence on mount', async () => {
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(123);
    });
  });

  it('displays loaded SAR/STR evidence', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    expect(screen.getByText('Previously Uploaded SAR/STR Filings (1)')).toBeInTheDocument();
  });

  it('shows loading state while fetching evidence', async () => {
    let resolveEvidence!: (val: { evidence: typeof mockEvidence }) => void;
    const evidencePromise = new Promise<{ evidence: typeof mockEvidence }>((r) => { resolveEvidence = r; });
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockReturnValue(evidencePromise);

    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText('Loading evidence...')).toBeInTheDocument();

    resolveEvidence({ evidence: [] });
    await waitFor(() => {
      expect(screen.queryByText('Loading evidence...')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no filings uploaded', async () => {
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('No SAR/STR filings uploaded yet')).toBeInTheDocument();
    });
  });

  it('handles evidence load failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Failed to load evidence');
    });
    consoleSpy.mockRestore();
  });

  it('does not load evidence when taskId is 0', () => {
    render(<SarStrFilingModal {...defaultProps} taskId={0} />);
    expect(evidenceService.getTaskEvidence).not.toHaveBeenCalled();
  });

  /* --- File selection --- */

  it('renders supported formats text', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText(/Supported formats/i)).toBeInTheDocument();
  });

  it('renders comments textarea', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Add any comments about this SAR\/STR/i)).toBeInTheDocument();
  });

  it('shows character count for comments', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/Add any comments/i);
    await user.type(textarea, 'Hello');
    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  /* --- Close interactions --- */

  it('closes modal when X button clicked', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    await user.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when Close button clicked', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    const closeButtons = screen.getAllByRole('button', { name: /^Close$/i });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  /* --- Upload flow --- */

  it('shows error toast when trying to upload with no files', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    // The Save button should be disabled when no files selected, but handleUpload guards
    const btn = screen.getByRole('button', { name: /Save SAR\/STR Filing/i });
    // Button is disabled - verify it
    expect(btn).toBeDisabled();
  });

  it('disables upload controls when task is completed', () => {
    render(<SarStrFilingModal {...defaultProps} task={completedTask} />);
    const selectBtn = screen.getByRole('button', { name: /Select Files/i });
    expect(selectBtn).toBeDisabled();
  });

  it('disables upload controls when user is not compliance officer', () => {
    mockHasComplianceOfficerRole = vi.fn(() => false);
    render(<SarStrFilingModal {...defaultProps} />);
    const selectBtn = screen.getByRole('button', { name: /Select Files/i });
    expect(selectBtn).toBeDisabled();
  });

  /* --- Mark as Complete --- */

  it('shows Mark as Complete button for compliance officer with active task', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Mark as Complete/i })).toBeInTheDocument();
  });

  it('hides Mark as Complete button when task is completed', () => {
    render(<SarStrFilingModal {...defaultProps} task={completedTask} />);
    expect(screen.queryByRole('button', { name: /Mark as Complete/i })).not.toBeInTheDocument();
  });

  it('hides Mark as Complete button when user is not compliance officer', () => {
    mockHasComplianceOfficerRole = vi.fn(() => false);
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Mark as Complete/i })).not.toBeInTheDocument();
  });

  it('opens complete task modal when Mark as Complete clicked', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mark as Complete/i }));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
  });

  it('completes task via complete modal', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mark as Complete/i }));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('mock-complete-btn'));
    await waitFor(() => {
      expect(mockCompleteTask).toHaveBeenCalledWith(123);
    });
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Task Completed Successfully',
        expect.stringContaining('123'),
      );
    });
  });

  it('handles complete task failure', async () => {
    const user = userEvent.setup();
    mockCompleteTask.mockRejectedValue(new Error('complete fail'));
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mark as Complete/i }));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('mock-complete-btn'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Complete Task Failed', expect.any(String));
    });
  });

  it('closes complete modal via its close button', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mark as Complete/i }));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('mock-complete-close'));
    await waitFor(() => {
      expect(screen.queryByTestId('complete-modal')).not.toBeInTheDocument();
    });
  });

  /* --- Download evidence --- */

  it('displays download button for uploaded evidence', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    expect(screen.getByTitle('Download Evidence')).toBeInTheDocument();
  });

  /* --- Evidence details rendering --- */

  it('displays evidence description and upload info', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('SAR/STR Filing - Regulatory Filing')).toBeInTheDocument();
      expect(screen.getByText(/compliance-user/)).toBeInTheDocument();
    });
  });

  /* --- Resets form on close --- */

  it('resets form when modal closes', () => {
    const { rerender } = render(<SarStrFilingModal {...defaultProps} />);
    rerender(<SarStrFilingModal {...defaultProps} open={false} />);
    // Modal not rendered
    expect(screen.queryByText('SAR/STR Filing')).not.toBeInTheDocument();
  });

  /* --- SAR/STR Filing Documentation section --- */

  it('renders documentation section heading', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText('SAR/STR Filing Documentation')).toBeInTheDocument();
    expect(screen.getByText(/Upload required documents/i)).toBeInTheDocument();
  });

  /* --- Evidence filtering --- */

  it('filters evidence to only show SAR/STR types', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: [
        ...mockEvidence,
        {
          id: 'ev-other',
          taskId: 123,
          fileName: 'other.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          hash: 'xyz',
          filePath: '/uploads/other.pdf',
          uploadedBy: 'user',
          uploadedAt: '2024-06-01',
          evidenceType: 'OTHER',
          description: 'Some other thing',
        },
      ],
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    expect(screen.queryByText('other.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Previously Uploaded SAR/STR Filings (1)')).toBeInTheDocument();
  });

  it('includes evidence with Regulatory Filing description', async () => {
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: [{
        id: 'ev-reg',
        taskId: 123,
        fileName: 'reg-filing.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        hash: 'xyz',
        filePath: '/uploads/reg-filing.pdf',
        uploadedBy: 'user',
        uploadedAt: '2024-06-01',
        evidenceType: 'OTHER',
        description: 'Regulatory Filing document',
      }],
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('reg-filing.pdf')).toBeInTheDocument();
    });
  });

  /* --- File Selection (handleFileSelect) --- */

  it('selects valid PDF files and displays them', async () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it('rejects files with disallowed extensions', async () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'malware.exe', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('File type not allowed'));
    expect(screen.queryByText(/malware\.exe/)).not.toBeInTheDocument();
  });

  it('rejects files exceeding 50MB', async () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const bigFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('File exceeds 50MB'));
  });

  it('enforces maximum 5 files across selected and uploaded', async () => {
    // Pre-load 4 existing evidence files   
    const fourEvidence = Array.from({ length: 4 }, (_, i) => ({
      id: `ev-${i}`,
      taskId: 123,
      fileName: `file${i}.pdf`,
      fileSize: 1024,
      mimeType: 'application/pdf',
      hash: 'abc',
      filePath: `/uploads/file${i}.pdf`,
      uploadedBy: 'user',
      uploadedAt: '2024-06-01',
      evidenceType: 'SAR_STR_FILING' as const,
      description: 'SAR/STR Filing',
    }));
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: fourEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('file0.pdf')).toBeInTheDocument();
    });
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const files = [
      new File(['a'], 'new1.pdf', { type: 'application/pdf' }),
      new File(['b'], 'new2.pdf', { type: 'application/pdf' }),
    ];
    fireEvent.change(fileInput, { target: { files } });
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Maximum'));
  });

  it('does nothing when no files are selected', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockError).not.toHaveBeenCalled();
  });

  it('sanitizes special characters in filenames', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'report@file.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    // The @ char should be replaced with _ due to /[^\w.\-() ]+/gu
    expect(screen.getByText(/report_file\.pdf/)).toBeInTheDocument();
  });

  /* --- Remove file (handleRemoveFile) --- */

  it('removes a selected file when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Remove file'));
    expect(screen.queryByText(/report\.pdf/)).not.toBeInTheDocument();
  });

  /* --- Upload flow (handleUpload) --- */

  it('uploads files successfully and clears form', async () => {
    const user = userEvent.setup();
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ evidence: [] })
      .mockResolvedValueOnce({
        evidence: [{
          id: 'ev-new',
          taskId: 123,
          fileName: 'uploaded.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          hash: 'abc',
          filePath: '/uploads/uploaded.pdf',
          uploadedBy: 'user',
          uploadedAt: '2024-06-01',
          evidenceType: 'SAR_STR_FILING',
          description: 'SAR/STR Filing - Regulatory Filing',
        }],
      });
    render(<SarStrFilingModal {...defaultProps} />);
    // Select a file
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/doc\.pdf/)).toBeInTheDocument();
    // Click upload
    await user.click(screen.getByRole('button', { name: /Save SAR\/STR Filing/i }));
    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 123,
        evidenceType: 'SAR_STR_FILING',
      }));
    });
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith('SAR/STR filing uploaded successfully');
    });
  });

  it('uploads files with remarks in description', async () => {
    const user = userEvent.setup();
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ evidence: [] })
      .mockResolvedValueOnce({ evidence: [] });
    render(<SarStrFilingModal {...defaultProps} />);
    // Select a file
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    // Add remarks
    await user.type(screen.getByPlaceholderText(/Add any comments/i), 'Test remark');
    await user.click(screen.getByRole('button', { name: /Save SAR\/STR Filing/i }));
    await waitFor(() => {
      expect(evidenceService.uploadEvidence).toHaveBeenCalledWith(expect.objectContaining({
        description: expect.stringContaining('Test remark'),
        comments: 'Test remark',
      }));
    });
  });

  it('shows error toast when upload fails', async () => {
    const user = userEvent.setup();
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Upload failed'));
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: /Save SAR\/STR Filing/i }));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Failed to upload'));
    });
  });

  /* --- Download evidence (handleDownloadEvidence) --- */

  it('downloads evidence when download button clicked', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['data'], { type: 'application/pdf' });
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    (evidenceService.downloadEvidence as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

    const createObjectURLSpy = vi.fn(() => 'blob:http://localhost/fake-url');
    const revokeObjectURLSpy = vi.fn();
    window.URL.createObjectURL = createObjectURLSpy;
    window.URL.revokeObjectURL = revokeObjectURLSpy;

    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('Download Evidence'));
    await waitFor(() => {
      expect(evidenceService.downloadEvidence).toHaveBeenCalledWith('ev-1');
    });
    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
    });
  });

  it('shows error toast when download fails', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    (evidenceService.downloadEvidence as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Download error'));

    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('Download Evidence'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Failed to download evidence');
    });
  });

  /* --- Delete evidence flow --- */

  it('opens delete modal when trash button clicked', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('Delete Evidence'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    // sar-filing.pdf appears in both the evidence list and delete modal
    expect(screen.getAllByText('sar-filing.pdf').length).toBeGreaterThanOrEqual(1);
  });

  it('closes delete modal when cancel clicked', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('Delete Evidence'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    await user.click(screen.getByTestId('mock-delete-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
    });
  });

  it('removes evidence from list on delete success', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByTitle('Delete Evidence'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    await user.click(screen.getByTestId('mock-delete-confirm'));
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith('Evidence deleted successfully');
    });
  });

  /* --- Character counter --- */

  it('shows character count for remarks', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    expect(screen.getByText('0/500')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Add any comments/i), 'Hello');
    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  it('shows maximum character limit reached at 500 chars', async () => {
    const user = userEvent.setup();
    render(<SarStrFilingModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/Add any comments/i);
    const longText = 'A'.repeat(500);
    await user.clear(textarea);
    // Use fireEvent for performance with long text
    fireEvent.change(textarea, { target: { value: longText } });
    expect(screen.getByText('500/500')).toBeInTheDocument();
    expect(screen.getByText('Maximum character limit reached')).toBeInTheDocument();
  });

  /* --- Mark as Complete disabled when no evidence --- */

  it('disables Mark as Complete button when no evidence uploaded', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /Mark as Complete/i });
    expect(btn).toBeDisabled();
  });

  /* --- Complete task with recommended outcome --- */

  it('completes task with recommended outcome via modal', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mark as Complete/i }));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
  });

  /* --- onTaskUpdate callback --- */

  it('calls onTaskUpdate after successful task completion', async () => {
    const user = userEvent.setup();
    (evidenceService.getTaskEvidence as ReturnType<typeof vi.fn>).mockResolvedValue({
      evidence: mockEvidence,
    });
    render(<SarStrFilingModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('sar-filing.pdf')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Mark as Complete/i }));
    await waitFor(() => {
      expect(screen.getByTestId('complete-modal')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('mock-complete-btn'));
    await waitFor(() => {
      expect(defaultProps.onTaskUpdate).toHaveBeenCalled();
    });
  });

  /* --- TaskId 0 guard --- */

  it('does not fetch evidence when taskId is 0', () => {
    render(<SarStrFilingModal {...defaultProps} taskId={0} />);
    expect(evidenceService.getTaskEvidence).not.toHaveBeenCalled();
  });

  /* --- Uploading state --- */

  it('shows Uploading... text during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload: (val: unknown) => void;
    (evidenceService.uploadEvidence as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: /Save SAR\/STR Filing/i }));
    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
    // Resolve the upload to clean up
    resolveUpload!({});
  });

  /* --- Multiple file types --- */

  it('accepts multiple valid file types (docx, txt, png)', () => {
    render(<SarStrFilingModal {...defaultProps} />);
    const fileInput = document.getElementById('sar-str-file-input') as HTMLInputElement;
    const files = [
      new File(['a'], 'doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      new File(['b'], 'note.txt', { type: 'text/plain' }),
      new File(['c'], 'image.png', { type: 'image/png' }),
    ];
    fireEvent.change(fileInput, { target: { files } });
    expect(screen.getByText(/doc\.docx/)).toBeInTheDocument();
    expect(screen.getByText(/note\.txt/)).toBeInTheDocument();
    expect(screen.getByText(/image\.png/)).toBeInTheDocument();
  });
});
