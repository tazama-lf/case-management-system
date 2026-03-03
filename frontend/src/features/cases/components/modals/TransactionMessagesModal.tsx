import React, { useState } from 'react';
import { MessagePayloadModal } from '../../../alerts';

interface TransactionMessage {
  id: string;
  type: string;
  description: string;
  isHighlighted?: boolean;
  payload?: string;
}

interface TransactionMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  messages: TransactionMessage[];
  transactionData?: unknown; // The actual transaction payload
}

const TransactionMessagesModal: React.FC<TransactionMessagesModalProps> = ({
  isOpen,
  onClose,
  transactionId,
  messages,
  transactionData,
}) => {
  const [payloadModalOpen, setPayloadModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<TransactionMessage | null>(null);

  const handleMessageClick = (message: TransactionMessage): void => {
    setSelectedMessage(message);
    setPayloadModalOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        {}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Transaction Messages
            </h2>
            <p className="text-sm text-gray-500">
              Transaction ID: {transactionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {}
        <div className="space-y-3">
          {messages.map((message) => (
            <button
              key={message.id}
              onClick={() => {
                handleMessageClick(message);
              }}
              className={`w-full flex items-center justify-between rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${
                message.isHighlighted
                  ? 'border-red-200 bg-red-50 hover:bg-red-100'
                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span
                  className={`font-mono text-sm ${
                    message.isHighlighted ? 'text-red-700' : 'text-gray-700'
                  }`}
                >
                  {message.type}
                </span>
                <span className="text-sm text-gray-600">
                  {message.description}
                </span>
              </div>
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No transaction messages available
          </div>
        )}

        {/* Payload Modal */}
        <MessagePayloadModal
          isOpen={payloadModalOpen}
          onClose={() => {
            setPayloadModalOpen(false);
          }}
          message={
            selectedMessage
              ? {
                  ...selectedMessage,
                  timestamp: new Date().toISOString(),
                  status: 'received' as const,
                }
              : null
          }
          transactionData={transactionData}
        />
      </div>
    </div>
  );
};

export default TransactionMessagesModal;
