import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { TransactionMessage, Alert } from '../types/alertsdashboard.types';
import { extractTransactionMessagesFromAlert, extractTransactionIdFromAlert } from '../utils/transactionUtils';

interface TransactionMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert | null;
  onMessageClick: (message: TransactionMessage) => void;
}

const TransactionMessagesModal: React.FC<TransactionMessagesModalProps> = ({
  isOpen,
  onClose,
  alert,
  onMessageClick,
}) => {
  const [messages, setMessages] = useState<TransactionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract transaction messages from alert data when modal opens or alert changes
  useEffect(() => {
    const extractMessages = () => {
      if (!isOpen || !alert) {
        setMessages([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const transactionId = extractTransactionIdFromAlert(alert);
        const extractedMessages = extractTransactionMessagesFromAlert(alert.transaction, transactionId);
        setMessages(extractedMessages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to extract transaction messages');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    extractMessages();
  }, [isOpen, alert]);

  if (!isOpen) {
    return null;
  }

  const transactionId = alert ? extractTransactionIdFromAlert(alert) : 'Unknown';

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-2xl w-full">
          <div className="bg-white px-6 pt-6 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Transaction Messages
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Transaction ID:{' '}
                  <span className="font-mono font-medium">{transactionId}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading transaction messages...</span>
              </div>
            )}

            {/* Messages List */}
            {!loading && messages.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => onMessageClick(message)}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            {message.type}
                          </h4>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            message.status === 'sent' ? 'bg-green-100 text-green-800' :
                            message.status === 'received' ? 'bg-blue-100 text-blue-800' :
                            message.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {message.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {message.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(message.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && messages.length === 0 && !error && (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📄</div>
                <p className="text-gray-500 text-sm">
                  No transaction messages found for this transaction.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {loading ? 'Loading...' : 
                 error ? 'Error occurred' :
                 `${messages.length} message${messages.length !== 1 ? 's' : ''} found`}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionMessagesModal;
