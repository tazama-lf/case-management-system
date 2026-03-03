import React from 'react';
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import type { TransactionMessage } from '../types/alertsdashboard.types';

interface MessagePayloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: TransactionMessage | null;
  transactionData?: unknown; // The actual transaction payload from the alert
}

const MessagePayloadModal: React.FC<MessagePayloadModalProps> = ({
  isOpen,
  onClose,
  message,
  transactionData,
}) => {
  // Format the transaction data as JSON for display
  const getPayloadContent = (): string => {
    if (transactionData) {
      // Display the actual transaction data as formatted JSON
      return JSON.stringify(transactionData, null, 2);
    }

    // No transaction data available
    return 'No transaction data available';
  };

  const handleDownload = (): void => {
    if (!message || !transactionData) return;

    const payloadContent = getPayloadContent();

    const blob = new Blob([payloadContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${message.type}_${message.id}_payload.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen || !message) {
    return null;
  }

  const payloadContent = getPayloadContent();

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {}
        <div
          className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-4xl w-full max-h-[90vh]">
          <div className="bg-white px-6 pt-6 pb-6 flex flex-col max-h-[90vh]">
            {}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Message Payload: {message.type}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {message.description}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(message.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownload}
                  disabled={!transactionData}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                  Download JSON
                </button>
                <button
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Payload Content */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex-shrink-0">
                  <h4 className="text-sm font-medium text-gray-700">
                    Transaction Payload (JSON)
                  </h4>
                </div>
                <div
                  className="p-4 overflow-auto flex-1 bg-white"
                  style={{ maxHeight: 'calc(90vh - 250px)' }}
                >
                  <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                    {payloadContent}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex-shrink-0">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Message ID: <span className="font-mono">{message.id}</span>
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownload}
                  disabled={!transactionData}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Download
                </button>
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
    </div>
  );
};

export default MessagePayloadModal;
