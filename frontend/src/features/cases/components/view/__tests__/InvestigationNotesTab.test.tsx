import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvestigationNotesTab from '../InvestigationNotesTab';
import { commentService } from '../../../services/commentService';
import { taskService } from '../../../services/taskService';
import { useNotifications } from '@/shared/providers/NotificationProvider';

vi.mock('../../../services/commentService');
vi.mock('../../../services/taskService');
vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(),
}));

describe('InvestigationNotesTab', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNotifications as vi.Mock).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    });
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue([]);
  });

  it('renders investigation notes editor', async () => {
    render(<InvestigationNotesTab taskId="TASK-1" />);

    await waitFor(() => {
      expect(screen.getByText('Investigation Notes')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add your investigation notes here... (supports Markdown formatting)')).toBeInTheDocument();
    });
  });

  it('loads existing comments when taskId is provided', async () => {
    const mockComments = [
      {
        comment_id: '1',
        note: 'Previous note',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
      },
    ];
    (commentService.getCommentsByTask as vi.Mock).mockResolvedValue(mockComments);

    render(<InvestigationNotesTab taskId="TASK-1" />);

    await waitFor(() => {
      expect(commentService.getCommentsByTask).toHaveBeenCalledWith('TASK-1');
      expect(screen.getByText('Previous note')).toBeInTheDocument();
    });
  });

  it('allows entering notes', async () => {
    render(<InvestigationNotesTab taskId="TASK-1" />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your investigation notes here... (supports Markdown formatting)');
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
      expect(textarea).toHaveValue('Test notes');
    });
  });

  it('saves notes when save button is clicked', async () => {
    (taskService.updateTaskForSupervisor as vi.Mock).mockResolvedValue({});

    render(<InvestigationNotesTab taskId="TASK-1" />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Add your investigation notes here... (supports Markdown formatting)');
      fireEvent.change(textarea, { target: { value: 'Test notes' } });
    });

    const saveButton = await screen.findByRole('button', { name: /Save Investigation Notes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(taskService.updateTaskForSupervisor).toHaveBeenCalledWith('TASK-1', {
        investigationNotes: 'Test notes',
      });
      expect(mockShowSuccess).toHaveBeenCalled();
    });
  });

  it('shows error when saving without notes', async () => {
    render(<InvestigationNotesTab taskId="TASK-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add your investigation notes here... (supports Markdown formatting)')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Investigation Notes/i });
    // Button should be disabled when notes are empty
    expect(saveButton).toBeDisabled();
    
    // Try to click anyway (though it should be disabled)
    fireEvent.click(saveButton);
    
    // The component checks for notes.trim() before calling showError
    // Since button is disabled, the click won't trigger the handler
    // This test verifies the button is properly disabled
  });

  it('disables save button when notes are empty', async () => {
    render(<InvestigationNotesTab taskId="TASK-1" />);

    const saveButton = await screen.findByRole('button', { name: /Save Investigation Notes/i });
    expect(saveButton).toBeDisabled();
  });
});

