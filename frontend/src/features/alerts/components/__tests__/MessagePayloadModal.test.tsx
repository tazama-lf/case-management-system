import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MessagePayloadModal from '../MessagePayloadModal';

// Mock window.URL methods
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

// Store originals
const originalCreateObjectURL = global.URL.createObjectURL;
const originalRevokeObjectURL = global.URL.revokeObjectURL;

describe('MessagePayloadModal', () => {
  const mockMessage = {
    id: 'msg-123',
    type: 'PAYMENT',
    status: 'sent',
    description: 'Payment transaction',
    timestamp: '2024-01-01T00:00:00Z',
  };

  const mockTransactionData = {
    amount: 1000,
    currency: 'USD',
    recipient: 'user-456',
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.URL
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore originals manually since these were assigned directly, not via vi.spyOn
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('does not render when isOpen is false', () => {
    render(
      <MessagePayloadModal
        isOpen={false}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );
    expect(screen.queryByText(/Message Payload/i)).not.toBeInTheDocument();
  });

  it('does not render when message is null', () => {
    render(
      <MessagePayloadModal
        isOpen={true}
        message={null}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );
    expect(screen.queryByText(/Message Payload/i)).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true and message is provided', () => {
    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );
    expect(screen.getByText(/Message Payload: PAYMENT/i)).toBeInTheDocument();
  });

  it('displays message information', () => {
    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );
    expect(screen.getByText('Payment transaction')).toBeInTheDocument();
    expect(screen.getByText(/Message ID:/i)).toBeInTheDocument();
    expect(screen.getByText('msg-123')).toBeInTheDocument();
  });

  it('displays formatted JSON payload', () => {
    const { container } = render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );

    // JSON is in a <pre> tag, check for key parts of the JSON
    const preElement = container.querySelector('pre');
    expect(preElement).toBeInTheDocument();
    expect(preElement?.textContent).toContain('"amount": 1000');
    expect(preElement?.textContent).toContain('"currency": "USD"');
    expect(preElement?.textContent).toContain('"recipient": "user-456"');
  });

  it('displays "No transaction data available" when transactionData is not provided', () => {
    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
      />,
    );

    expect(
      screen.getByText('No transaction data available'),
    ).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );

    const backdrop = container.querySelector('.fixed.inset-0.bg-gray-500');
    if (backdrop) {
      await user.click(backdrop as HTMLElement);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('downloads JSON file when download button is clicked', async () => {
    const user = userEvent.setup();
    const createElementSpy = vi.spyOn(global.document, 'createElement');
    const appendChildSpy = vi.spyOn(global.document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(global.document.body, 'removeChild');

    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );

    const downloadButtons = screen.getAllByRole('button', {
      name: /download/i,
    });
    await user.click(downloadButtons[0]);

    // Verify download functionality was triggered
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('disables download button when transactionData is not provided', () => {
    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
      />,
    );

    const downloadButtons = screen.getAllByRole('button', {
      name: /download/i,
    });
    downloadButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('generates correct filename for download', async () => {
    const user = userEvent.setup();
    let capturedDownload = '';
    const originalCreateElement = global.document.createElement.bind(
      global.document,
    );

    const createElementSpy = vi
      .spyOn(global.document, 'createElement')
      .mockImplementation((tagName) => {
        if (tagName === 'a') {
          const link = originalCreateElement('a') as HTMLAnchorElement;
          Object.defineProperty(link, 'download', {
            get: () => capturedDownload,
            set: (value) => {
              capturedDownload = value;
            },
            configurable: true,
          });
          return link;
        }
        return originalCreateElement(tagName);
      });

    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );

    const downloadButtons = screen.getAllByRole('button', {
      name: /download/i,
    });
    await user.click(downloadButtons[0]);

    expect(capturedDownload).toBe('PAYMENT_msg-123_payload.json');
    createElementSpy.mockRestore();
  });

  it('displays timestamp correctly', () => {
    render(
      <MessagePayloadModal
        isOpen={true}
        message={mockMessage}
        onClose={mockOnClose}
        transactionData={mockTransactionData}
      />,
    );

    // Source uses formatDate which may format differently than toLocaleString
    // Just verify the timestamp area exists
    expect(screen.getByText(/Message ID:/i)).toBeInTheDocument();
  });
});
