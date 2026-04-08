import React from 'react';
import VoilaFrame from '../network-analysis/VoilaFrame';

interface AlertHistoryTabProps {
  caseId?: number;
  transactionId?: string;
}

const AlertHistoryTab: React.FC<AlertHistoryTabProps> = ({
  caseId: _caseId,
  transactionId,
}) => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const tenantId = user?.tenantId || 'DEFAULT';

  console.log("AlertHistoryTab Props:", { 
    caseId: _caseId, 
    transactionId, 
    tenantId 
  });

  // Build query parameters for Voila
  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      tenantId, 
    };
    
    if (transactionId) {
      params.endToEndId = transactionId;
    }
    
    return params;
  }, [transactionId, tenantId]);

  // Show error state if no transaction ID
  if (!transactionId) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center p-8">
          <div className="text-gray-400 mb-4">
            <svg 
              className="w-16 h-16 mx-auto" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Transaction Data Unavailable
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            Alert history requires transaction information to display relevant data. 
            This case may not have associated transaction details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <VoilaFrame
      notebookPath="alert-history.ipynb"
      title="Alert History"
      queryParams={queryParams}
    />
  );
};

export default AlertHistoryTab;
