import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateQueueModal from '../../modals/CreateQueueModal';

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

const mockCreateCandidateGroup = vi.fn();
vi.mock('../../../services/workQueueService', () => ({
  default: {
    createCandidateGroup: (...args: any[]) => mockCreateCandidateGroup(...args),
  },
}));

describe('CreateQueueModal', () => {
  const onClose = vi.fn();
  const onCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not open', () => {
    const { container } = render(
      <CreateQueueModal open={false} onClose={onClose} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders form when open', () => {
    render(<CreateQueueModal open={true} onClose={onClose} />);
    expect(screen.getByText('Create Work Queue')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a unique queue identifier')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a descriptive name for the queue')).toBeInTheDocument();
  });

  it('disables create button when fields are empty', () => {
    render(<CreateQueueModal open={true} onClose={onClose} />);
    const createBtn = screen.getByRole('button', { name: /create queue/i });
    expect(createBtn).toBeDisabled();
  });

  it('enables create button when fields are filled', () => {
    render(<CreateQueueModal open={true} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Enter a unique queue identifier'), {
      target: { value: 'fraud-team' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter a descriptive name for the queue'), {
      target: { value: 'Fraud Team' },
    });
    const createBtn = screen.getByRole('button', { name: /create queue/i });
    expect(createBtn).not.toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<CreateQueueModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('creates queue successfully', async () => {
    mockCreateCandidateGroup.mockResolvedValue({});
    render(<CreateQueueModal open={true} onClose={onClose} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('Enter a unique queue identifier'), {
      target: { value: 'fraud-team' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter a descriptive name for the queue'), {
      target: { value: 'Fraud Team' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create queue/i }));

    await waitFor(() => {
      expect(mockCreateCandidateGroup).toHaveBeenCalledWith({
        groupId: 'fraud-team',
        groupName: 'Fraud Team',
        groupType: 'candidate',
      });
    });
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith('Queue Created', 'Candidate group created successfully');
    });
  });

  it('handles creation error', async () => {
    mockCreateCandidateGroup.mockRejectedValue(new Error('Duplicate group'));
    render(<CreateQueueModal open={true} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText('Enter a unique queue identifier'), {
      target: { value: 'fraud-team' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter a descriptive name for the queue'), {
      target: { value: 'Fraud Team' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create queue/i }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Creation Failed', 'Duplicate group');
    });
  });
});
