import React from 'react';

interface AlertMetadataProps {
  alertId: string;
  timestamp: string;
  transactionType: string;
  entity?: string;
  transactionId: string;
  reason: string;
  blockReason?: string;
}

export const AlertMetadata: React.FC<AlertMetadataProps> = ({
  alertId,
  timestamp,
  transactionType,
  entity = 'Binance',
  transactionId,
  reason,
  blockReason,
}) => (
  <div className="rounded-lg border border-gray-200 bg-white p-5">
    <h4 className="text-sm font-semibold text-gray-900 mb-4">Alert Metadata</h4>
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Alert ID
        </div>
        <div className="text-sm font-medium text-gray-900">{alertId}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Timestamp
        </div>
        <div className="text-sm font-medium text-gray-900">{timestamp}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Transaction Type
        </div>
        <div className="text-sm font-medium text-gray-900">
          {transactionType}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Entity
        </div>
        <div className="text-sm font-medium text-blue-600">{entity}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Transaction ID
        </div>
        <div className="text-sm font-medium text-gray-900">{transactionId}</div>
      </div>
      <div className="col-span-2">
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Reason
        </div>
        <div className="text-sm text-gray-900">{reason}</div>
      </div>
      {blockReason && (
        <div className="col-span-2">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Block Reason
          </div>
          <div className="text-sm text-gray-900">{blockReason}</div>
        </div>
      )}
    </div>
  </div>
);
