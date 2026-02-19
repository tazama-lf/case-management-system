import React from 'react';
import JupyterVisualization from '../shared/JupyterVisualization';

interface AlertHistoryTabProps {
  caseId?: number;
  transactionId?: string;
}

const AlertHistoryTab: React.FC<AlertHistoryTabProps> = ({
  caseId,
  transactionId,
}) => {
  const fallbackEndToEndId = '05c7ead85a1343d5a959561523a965fb';
  const effectiveEndToEndId = transactionId || fallbackEndToEndId;

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Alert History View</h2>
          <p className="text-sm text-gray-600 mt-1">
            Historical alerts, cases, investigations, and SAR/STR filings for{' '}
            {caseId || transactionId || fallbackEndToEndId}
          </p>
        </div>
      </div>

      <div className="h-[1400px]">
        <JupyterVisualization
          notebook="alert-history"
          params={{
            endToEndId: effectiveEndToEndId,
            tenantId: 'DEFAULT',
            dateRange: 'all',
            granularity: 'day',
          }}
          title="Alert History"
          height="100%"
        />
      </div>
    </div>
  );
};

export default AlertHistoryTab;
