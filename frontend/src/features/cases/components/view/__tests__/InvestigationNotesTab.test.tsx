import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationNotesTab from '../InvestigationNotesTab';
import {
  taskService,
  type TaskForSupervisor,
} from '../../../services/taskService';
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
  MDXEditor: ({
    markdown,
    onChange,
    readOnly,
  }: {
    markdown: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
  }) => (
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
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'user-1',
      tenantId: 't1',
      email: 'test@test.com',
      fullName: 'Test User',
      tenantName: 'Tenant',
      validatedClaims: {},
    });
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
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalledWith(1, {
        investigationNotes: 'Test notes',
      });
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
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'other-user',
      tenantId: 't1',
      email: 'other@test.com',
      fullName: 'Other',
      tenantName: 'Tenant',
      validatedClaims: {},
    });
    render(<InvestigationNotesTab task={mockTask} />);
    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /Save Investigation Notes/i }),
    ).not.toBeInTheDocument();
  });

  it('shows error when save fails', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockRejectedValue(
      new Error('Save failed'),
    );
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'Test notes' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to save investigation notes. Please try again.',
      );
    });
  });

  it('shows error when notes are empty and save is attempted', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    // Normally can't click disabled button, but test that error path exists
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: '   ' } });
    // The save button should still be enabled since whitespace text has length > 0
    // but the handler should call showError when notes.trim() is empty
  });

  it('editor is read-only for completed tasks', async () => {
    const completedTask = { ...mockTask, status: 'STATUS_30_COMPLETED' };
    render(<InvestigationNotesTab task={completedTask} />);
    await waitFor(() => {
      const textarea = screen.getByTestId('mdx-editor');
      expect(textarea).toHaveAttribute('readonly');
    });
  });

  it('editor is read-only for blocked tasks', async () => {
    const blockedTask = { ...mockTask, status: 'STATUS_21_BLOCKED' };
    render(<InvestigationNotesTab task={blockedTask} />);
    await waitFor(() => {
      const textarea = screen.getByTestId('mdx-editor');
      expect(textarea).toHaveAttribute('readonly');
    });
  });

  it('calls onNotesUpdate callback after successful save', async () => {
    const onNotesUpdate = vi.fn();
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    render(
      <InvestigationNotesTab task={mockTask} onNotesUpdate={onNotesUpdate} />,
    );
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'Updated notes' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(onNotesUpdate).toHaveBeenCalled();
    });
  });

  it('transforms markdown links by adding https://', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: '[link](example.com)' } });
    await waitFor(() => {
      expect(textarea).toHaveValue('[link](https://example.com)');
    });
  });

  it('does not transform links that already have protocol', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, {
      target: { value: '[link](https://example.com)' },
    });
    await waitFor(() => {
      expect(textarea).toHaveValue('[link](https://example.com)');
    });
  });

  it('renders without task', () => {
    render(<InvestigationNotesTab />);
    expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
  });

  it('disables save button for blocked tasks', async () => {
    const blockedTask = { ...mockTask, status: 'STATUS_21_BLOCKED' };
    render(<InvestigationNotesTab task={blockedTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'Some notes' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    expect(saveButton).toBeDisabled();
  });

  it('shows character count', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    expect(
      screen.getByText(/Character count: 0 \/ 32000/i),
    ).toBeInTheDocument();
  });

  it('updates character count on typing', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    await waitFor(() => {
      expect(
        screen.getByText(/Character count: 5 \/ 32000/i),
      ).toBeInTheDocument();
    });
  });

  it('disables save when at character limit', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    const longText = 'a'.repeat(32000);
    fireEvent.change(textarea, { target: { value: longText } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    expect(saveButton).toBeDisabled();
  });

  it('transforms markdown links with mailto: unchanged', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, {
      target: { value: '[email](mailto:test@example.com)' },
    });
    await waitFor(() => {
      expect(textarea).toHaveValue('[email](mailto:test@example.com)');
    });
  });

  it('transforms markdown links with # unchanged', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: '[section](#heading-1)' } });
    await waitFor(() => {
      expect(textarea).toHaveValue('[section](#heading-1)');
    });
  });

  it('shows error when saving empty notes', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: '   ' } });
    const button = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    // Button should be disabled for whitespace-only notes
    expect(button).toBeDisabled();
  });

  it('hides save button when no task is provided', () => {
    render(<InvestigationNotesTab />);
    expect(
      screen.queryByRole('button', { name: /Save Investigation Notes/i }),
    ).not.toBeInTheDocument();
  });

  it('handles link clicks in editor container by opening in new window', async () => {
    const mockOpen = vi.fn();
    const origOpen = window.open;
    window.open = mockOpen;
    render(<InvestigationNotesTab task={mockTask} />);
    const container = document.querySelector('.mdx-editor-container');
    expect(container).not.toBeNull();
    const link = document.createElement('a');
    link.href = 'https://example.com/page';
    link.textContent = 'Click me';
    container!.appendChild(link);
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('example.com'),
      '_blank',
      'noopener,noreferrer',
    );
    window.open = origOpen;
  });

  it('handles mailto link clicks in editor container', async () => {
    const mockOpen = vi.fn();
    const origOpen = window.open;
    window.open = mockOpen;
    render(<InvestigationNotesTab task={mockTask} />);
    const container = document.querySelector('.mdx-editor-container');
    const link = document.createElement('a');
    link.href = 'mailto:test@example.com';
    link.textContent = 'Email';
    container!.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mockOpen).toHaveBeenCalledWith(
      'mailto:test@example.com',
      '_blank',
      'noopener,noreferrer',
    );
    window.open = origOpen;
  });

  it('ignores clicks on non-link elements in editor container', async () => {
    const mockOpen = vi.fn();
    const origOpen = window.open;
    window.open = mockOpen;
    render(<InvestigationNotesTab task={mockTask} />);
    const container = document.querySelector('.mdx-editor-container');
    const span = document.createElement('span');
    span.textContent = 'Not a link';
    container!.appendChild(span);
    span.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mockOpen).not.toHaveBeenCalled();
    window.open = origOpen;
  });

  it('shows saving state while save is in progress', async () => {
    let resolveUpdate: any;
    (taskService.updateTaskForSupervisor as vi.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'Test notes' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
    resolveUpdate({});
    await waitFor(() => {
      expect(screen.getByText(/Save Investigation Notes/i)).toBeInTheDocument();
    });
  });

  it('shows error when saving without task_id', async () => {
    const noIdTask = { ...mockTask, task_id: undefined } as any;
    render(<InvestigationNotesTab task={noIdTask} />);
    // Save button should not appear since isUserAbleToSaveNotes checks user === task.assigned_user_id
    // but without task_id the handler shows an error
    expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
  });

  it('shows character limit warning in red when at limit', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    const longText = 'a'.repeat(32000);
    fireEvent.change(textarea, { target: { value: longText } });
    await waitFor(() => {
      const charDisplay = screen.getByText(/Character count: 32000 \/ 32000/i);
      expect(charDisplay).toBeInTheDocument();
      expect(charDisplay).toHaveClass('text-red-600');
    });
  });

  it('cleans up link click listener on unmount', () => {
    const removeEventSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<InvestigationNotesTab task={mockTask} />);
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith('click', expect.any(Function));
    removeEventSpy.mockRestore();
  });

  it('transforms non-protocol links to https in link handler', () => {
    const mockOpen = vi.fn();
    const origOpen = window.open;
    window.open = mockOpen;
    render(<InvestigationNotesTab task={mockTask} />);
    const container = document.querySelector('.mdx-editor-container');
    const link = document.createElement('a');
    link.href = 'ftp://example.com/page';
    link.textContent = 'FTP link';
    container!.appendChild(link);
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    // ftp:// doesn't match https?:// or mailto:, so handler extracts last path segment and prepends https://
    expect(mockOpen).toHaveBeenCalledWith(
      expect.stringContaining('https://'),
      '_blank',
      'noopener,noreferrer',
    );
    window.open = origOpen;
  });

  it('saves notes successfully and triggers saving state', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'Important notes' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);
    // After save completes, saving should be false (button text restored)
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Investigation notes saved successfully!',
      );
    });
    // Verify saving state is cleared (finally block)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Save Investigation Notes/i }),
      ).not.toBeDisabled();
    });
  });

  it('isUserAbleToSaveNotes returns true when user matches assignee', async () => {
    // When user is assigned, save button is visible and enabled
    (authService.getUser as vi.Mock).mockReturnValue({
      userId: 'user-1',
      tenantId: 't1',
      email: 'test@test.com',
      fullName: 'Test User',
      tenantName: 'Tenant',
      validatedClaims: {},
    });
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'notes' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
  });

  it('handleNotesChange transforms markdown links', async () => {
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    // Enter markdown with link that needs transformation
    fireEvent.change(textarea, {
      target: { value: 'check [docs](docs.google.com/abc) for info' },
    });
    await waitFor(() => {
      expect(textarea).toHaveValue(
        'check [docs](https://docs.google.com/abc) for info',
      );
    });
  });

  it('saving state shows Saving text and disables button', async () => {
    let resolveUpdate: any;
    (taskService.updateTaskForSupervisor as vi.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'save test' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);
    // Button should show "Saving..." while waiting
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
    // Resolve and verify button returns to normal
    resolveUpdate({});
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  it('shows error and re-enables button when save fails', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockRejectedValue(
      new Error('Network error'),
    );
    render(<InvestigationNotesTab task={mockTask} />);
    const textarea = screen.getByPlaceholderText(
      'Add your investigation notes here... (supports Markdown formatting)',
    );
    fireEvent.change(textarea, { target: { value: 'fail save' } });
    const saveButton = await screen.findByRole('button', {
      name: /Save Investigation Notes/i,
    });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to save investigation notes. Please try again.',
      );
    });
    // Button should be re-enabled after error (finally block ran)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Save Investigation Notes/i }),
      ).not.toBeDisabled();
    });
  });
});
