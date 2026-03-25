import React from 'react';
import VoilaFrame from './VoilaFrame';

const FALLBACK_ACCOUNT_ID = 'dbtrAcct_24a03dafa2c14f6da6bfc195d57c6d21';

interface TransactionNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  timeRange?: string;
}

const TransactionNetworkTab: React.FC<TransactionNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange = '30d',
}) => {
  const queryParams = React.useMemo(
    () => ({ accountId: FALLBACK_ACCOUNT_ID, timeRange }),
    [timeRange],
  );

  return (
    <VoilaFrame
      notebookPath="transaction-network.ipynb"
      title="Transaction Network"
      queryParams={queryParams}
    />
  );
};

export default TransactionNetworkTab;
