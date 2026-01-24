import React from 'react';

const FALLBACK_ACCOUNT_ID = 'dbtrAcct_24a03dafa2c14f6da6bfc195d57c6d21';

interface TransactionNetworkTabProps {
  caseId?: string;
  transactionId?: string;
  timeRange?: string;
}

const TransactionNetworkTab: React.FC<TransactionNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange = '30d',
}) => {
  const iframeUrl = React.useMemo(() => {
    const baseUrl =
      (import.meta as any).env?.VITE_VOILA_BASE_URL || 'http://localhost:8866';
    const queryParams = new URLSearchParams({
      accountId: FALLBACK_ACCOUNT_ID,
      timeRange,
    });
    return `${baseUrl}/voila/render/transaction-network.ipynb?${queryParams.toString()}`;
  }, [timeRange]);

  return (
    <div className="flex h-[750px] w-full flex-col bg-white p-4">
      <iframe
        src={iframeUrl}
        className="h-full w-full border-0"
        title="Transaction Network"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
};

export default TransactionNetworkTab;
