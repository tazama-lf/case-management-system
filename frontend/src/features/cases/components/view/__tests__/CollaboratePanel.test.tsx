import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CollaboratePanel from '../CollaboratePanel';
import type {
  Collaborator,
  NewDiscussionThreadPayload,
} from '../NewDiscussionThreadModal';

const mockCollaborators: Collaborator[] = [
  { id: '1', name: 'John Doe', role: 'Investigator' },
  { id: '2', name: 'Jane Smith', role: 'Supervisor' },
];

describe('CollaboratePanel', () => {
  const mockOnCreateThread = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collaboration information', () => {
    render(
      <CollaboratePanel
        collaborators={mockCollaborators}
        onCreateThread={mockOnCreateThread}
      />,
    );

    expect(screen.getByText('Alert Stage')).toBeInTheDocument();
    expect(screen.getByText('Investigate')).toBeInTheDocument();
    expect(screen.getByText('Flagged Transaction')).toBeInTheDocument();
  });

  it('displays default collaborators when none provided', () => {
    render(<CollaboratePanel onCreateThread={mockOnCreateThread} />);
    expect(
      screen.getByText('Collaborators & Task Assignments'),
    ).toBeInTheDocument();
  });

  it('opens new discussion thread modal when button is clicked', () => {
    render(
      <CollaboratePanel
        collaborators={mockCollaborators}
        onCreateThread={mockOnCreateThread}
      />,
    );

    const newThreadButton = screen.getByText('+ New Thread');
    fireEvent.click(newThreadButton);

    expect(
      screen.getByText('Create New Discussion Thread'),
    ).toBeInTheDocument();
  });

  it('calls onCreateThread when thread is created', () => {
    render(
      <CollaboratePanel
        collaborators={mockCollaborators}
        onCreateThread={mockOnCreateThread}
      />,
    );

    const newThreadButton = screen.getByText('+ New Thread');
    fireEvent.click(newThreadButton);

    const titleInput = screen.getByPlaceholderText('Enter a descriptive title');
    const messageInput = screen.getByPlaceholderText('Start the discussion...');

    fireEvent.change(titleInput, { target: { value: 'Test Thread' } });
    fireEvent.change(messageInput, { target: { value: 'Test Message' } });

    const createButton = screen.getByText('Create Thread');
    fireEvent.click(createButton);

    expect(mockOnCreateThread).toHaveBeenCalledWith({
      title: 'Test Thread',
      message: 'Test Message',
      collaboratorIds: [],
    });
  });

  it('displays discussion threads', () => {
    render(
      <CollaboratePanel
        collaborators={mockCollaborators}
        onCreateThread={mockOnCreateThread}
      />,
    );

    expect(
      screen.getByText('Transaction Pattern Analysis'),
    ).toBeInTheDocument();
  });
});
