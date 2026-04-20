import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationNotesTab from '../InvestigationNotesTab';
import { taskService, type TaskForSupervisor } from '../../../services/taskService';
import { useNotifications } from '@/shared/providers/NotificationProvider';
import { authService } from '@/features/auth';

vi.mock('../../../services/taskService');
vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(),
}));
vi.mock('@/features/auth', () => ({
  authService: {
    getUser: vi.fn(),
  },
}));
vi.mock('@mdxeditor/editor', () => ({
  MDXEditor: ({ markdown, onChange, readOnly }: { markdown: string; onChange?: (v: string) => void; readOnly?: boolean }) => (
    <textarea
      data-testid="mdx-editor"
      value={markdown}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={readOnly}
      placeholder="Add your investigation notes here... (supports Markdown formatting)"
    />
  ),
  BoldItalicUnderlineToggles: () => null,
  CreateLink: () => null,
  ListsToggle: () => null,
  UndoRedo: () => null,
  headingsPlugin: () => ({}),
  linkDialogPlugin: () => ({}),
  linkPlugin: () => ({}),
  listsPlugin: () => ({}),
  markdownShortcutPlugin: () => ({}),
  quotePlugin: () => ({}),
  toolbarPlugin: () => ({}),
}));

describe('InvestigationNotesTab', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  const mockTask: TaskForSupervisor = {
    task_id: 1,
    case_id: 100,
    status: 'STATUS_20_IN_PROGRESS',
    assigned_user_id: 'user-1',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useNotifications as vi.Mock).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });
    (authService.getUser as vi.Mock).mockReturnValue({ userId: 'user-1', tenantId: 't1', email: 'test@test.com', fullName: 'Test User', tenantName: 'Tenant', validatedClaims: {} });
  });

  it('renders investigation notes editor', async () => {
    render(<InvestigationNotesTab task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          'Add your investigation notes here... (supports Markdown formatting)',
        ),
      ).toBeInTheDocument();
    });
  });

  it('allows entering notes', async () => {
    render(<InvestigationNotesTab task={mockTask} />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        'Add your investigation notes here... (supports Markdown formatting)',
      );
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
      expect(textarea).toHaveValue('Test notes');
    });
  });

  it('saves notes when save button is clicked', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});

    render(<InvestigationNotesTab task={mockTask} />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        'Add your investigation notes here... (supports Markdown formatting)',
      );
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
    });

    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalledWith(
        1,
        {
          investigationNotes: 'Test notes',
        },
      );
      expect(mockShowSuccess).toHaveBeenCalled();
    });
  });

  it('disables save button when notes are empty', async () => {
    render(<InvestigationNotesTab task={mockTask} />);

    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    expect(saveButton).toBeDisabled();
  });

  it('does not show save button when user is not assigned', async () => {
    (authService.getUser as vi.Mock).mockReturnValue({ userId: 'other-user', tenantId: 't1', email: 'other@test.com', fullName: 'Other', tenantName: 'Tenant', validatedClaims: {} });

    render(<InvestigationNotesTab task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Save Investigation Notes/i })).not.toBeInTheDocument();
  });
});
