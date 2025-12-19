import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewDiscussionThreadModal, {
  type Collaborator,
  type NewDiscussionThreadPayload,
} from '../NewDiscussionThreadModal';

const mockCollaborators: Collaborator[] = [
  { id: '1', name: 'John Doe', role: 'Investigator' },
  { id: '2', name: 'Jane Smith', role: 'Supervisor' },
];

describe('NewDiscussionThreadModal', () => {
  const mockOnCreate = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(
      <NewDiscussionThreadModal
        open={false}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.queryByText('Create New Discussion Thread')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('Create New Discussion Thread')).toBeInTheDocument();
  });

  it('allows entering title and message', () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const titleInput = screen.getByPlaceholderText('Enter a descriptive title');
    const messageInput = screen.getByPlaceholderText('Start the discussion...');

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(messageInput, { target: { value: 'Test Message' } });

    expect(titleInput).toHaveValue('Test Title');
    expect(messageInput).toHaveValue('Test Message');
  });

  it('disables create button when title or message is empty', () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const createButton = screen.getByText('Create Thread');
    expect(createButton).toBeDisabled();
  });

  it('enables create button when title and message are filled', () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const titleInput = screen.getByPlaceholderText('Enter a descriptive title');
    const messageInput = screen.getByPlaceholderText('Start the discussion...');

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(messageInput, { target: { value: 'Test Message' } });

    const createButton = screen.getByText('Create Thread');
    expect(createButton).not.toBeDisabled();
  });

  it('calls onCreate with correct payload when submitted', async () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const titleInput = screen.getByPlaceholderText('Enter a descriptive title');
    const messageInput = screen.getByPlaceholderText('Start the discussion...');

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(messageInput, { target: { value: 'Test Message' } });

    const createButton = screen.getByText('Create Thread');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockOnCreate).toHaveBeenCalledWith({
        title: 'Test Title',
        message: 'Test Message',
        collaboratorIds: [],
      });
    });
  });

  it('allows selecting collaborators', () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    fireEvent.click(checkboxes[0]);

    const createButton = screen.getByText('Create Thread');
    fireEvent.change(screen.getByPlaceholderText('Enter a descriptive title'), {
      target: { value: 'Test Title' },
    });
    fireEvent.change(screen.getByPlaceholderText('Start the discussion...'), {
      target: { value: 'Test Message' },
    });

    fireEvent.click(createButton);

    expect(mockOnCreate).toHaveBeenCalledWith({
      title: 'Test Title',
      message: 'Test Message',
      collaboratorIds: ['1'],
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('resets form when modal is closed and reopened', () => {
    const { rerender } = render(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    const titleInput = screen.getByPlaceholderText('Enter a descriptive title');
    fireEvent.change(titleInput, { target: { value: 'Test Title' } });

    rerender(
      <NewDiscussionThreadModal
        open={false}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    rerender(
      <NewDiscussionThreadModal
        open={true}
        onClose={mockOnClose}
        collaborators={mockCollaborators}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByPlaceholderText('Enter a descriptive title')).toHaveValue('');
  });
});

