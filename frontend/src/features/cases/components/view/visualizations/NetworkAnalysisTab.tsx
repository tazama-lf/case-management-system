import React from 'react';

interface NetworkAnalysisTabProps {
  caseId?: string;
  transactionId?: string;
}

const NetworkAnalysisTab: React.FC<NetworkAnalysisTabProps> = ({
  caseId,
  transactionId,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-700 mb-2">
            Network Analysis
          </div>
          <div className="text-sm text-gray-600">
            Network analysis visualization will be displayed here.
          </div>
          {caseId && (
            <div className="mt-2 text-xs text-gray-500">
              Case ID: {caseId}
            </div>
          )}w
          {transactionId && (
            <div className="mt-1 text-xs text-gray-500">
              Transaction ID: {transactionId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkAnalysisTab;
