import React from 'react';

interface TransactionOverviewProps {
  transactionId: string;
  timestamp: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
}

export const TransactionOverview: React.FC<TransactionOverviewProps> = ({
  transactionId,
  timestamp,
  type,
  amount,
  currency,
  status,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-4">Transaction Overview</h4>
      <div className="grid grid-cols-4 gap-6">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">Transaction ID</div>
          <div className="text-sm font-medium text-gray-900 break-all">{transactionId}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">Timestamp</div>
          <div className="text-sm font-medium text-gray-900">{timestamp}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">Type</div>
          <div className="text-sm font-medium text-gray-900">{type}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">Amount</div>
          <div className="text-sm font-bold text-gray-900">
            {amount} {currency}
          </div>
        </div>
      </div>
    </div>
  );
};
