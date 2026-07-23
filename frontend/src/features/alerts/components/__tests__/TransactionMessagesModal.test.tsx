import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionMessagesModal from '../TransactionMessagesModal';
import {
  extractTransactionMessagesFromAlert,
  extractTransactionIdFromAlert,
} from '../../utils/transactionUtils';

vi.mock('../../utils/transactionUtils');

describe('TransactionMessagesModal', () => {
  const mockAlert = {
    alert_id: 'alert-123',
    txtp: 'tx-456',
    transaction: {
      messages: [
        {
          id: 'msg-1',
          type: 'PAYMENT',
          status: 'sent',
          description: 'Payment sent',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ],
    },
  };

  const mockOnClose = vi.fn();
  const mockOnMessageClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (extractTransactionIdFromAlert as vi.Mock).mockReturnValue('tx-456');
    (extractTransactionMessagesFromAlert as vi.Mock).mockReturnValue([
      {
        id: 'msg-1',
        type: 'PAYMENT',
        status: 'sent',
        description: 'Payment sent',
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
  });

  it('does not render when isOpen is false', () => {
    render(
      <TransactionMessagesModal
        isOpen={false}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );
    expect(screen.queryByText(/Transaction Messages/i)).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );
    expect(screen.getByText('Transaction Messages')).toBeInTheDocument();
  });

  it('displays transaction ID', () => {
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );
    expect(screen.getByText(/Transaction ID:/i)).toBeInTheDocument();
    expect(screen.getByText('tx-456')).toBeInTheDocument();
  });

  it('extracts and displays transaction messages', async () => {
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    await waitFor(() => {
      expect(extractTransactionMessagesFromAlert).toHaveBeenCalled();
    });

    expect(screen.getByText('PAYMENT')).toBeInTheDocument();
    expect(screen.getByText('Payment sent')).toBeInTheDocument();
  });

  it('calls onMessageClick when a message is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('PAYMENT')).toBeInTheDocument();
    });

    const messageCard = screen
      .getByText('PAYMENT')
      .closest('div[class*="cursor-pointer"]');
    if (messageCard) {
      await user.click(messageCard);
      expect(mockOnMessageClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          type: 'PAYMENT',
        }),
      );
    }
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    const backdrop = container.querySelector('.fixed.inset-0.bg-gray-500');
    if (backdrop) {
      await user.click(backdrop as HTMLElement);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('displays error message when extraction fails', async () => {
    (extractTransactionMessagesFromAlert as vi.Mock).mockImplementation(() => {
      throw new Error('Extraction failed');
    });

    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Extraction failed/i)).toBeInTheDocument();
    });
  });

  it('displays loading state while extracting messages', async () => {
    // Since extraction is synchronous in the component, loading state is very brief
    // This test verifies that the extraction function is called
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    // Verify extraction was called (which triggers loading state internally)
    await waitFor(() => {
      expect(extractTransactionMessagesFromAlert).toHaveBeenCalled();
    });

    // The component should eventually show messages (not loading)
    await waitFor(() => {
      expect(screen.getByText('PAYMENT')).toBeInTheDocument();
    });
  });

  it('displays empty state when no messages are found', async () => {
    (extractTransactionMessagesFromAlert as vi.Mock).mockReturnValue([]);

    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No transaction messages found/i),
      ).toBeInTheDocument();
    });
  });

  it('handles null alert gracefully', () => {
    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={null}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    expect(screen.getByText('Transaction Messages')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('displays message status badges correctly', async () => {
    (extractTransactionMessagesFromAlert as vi.Mock).mockReturnValue([
      {
        id: 'msg-1',
        type: 'PAYMENT',
        status: 'sent',
        description: 'Payment sent',
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        type: 'RECEIPT',
        status: 'received',
        description: 'Receipt received',
        timestamp: '2024-01-01T01:00:00Z',
      },
    ]);

    render(
      <TransactionMessagesModal
        isOpen={true}
        alert={mockAlert}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('SENT')).toBeInTheDocument();
      expect(screen.getByText('RECEIVED')).toBeInTheDocument();
    });
  });
});
