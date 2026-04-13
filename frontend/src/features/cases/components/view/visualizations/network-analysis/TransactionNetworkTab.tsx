import React from 'react';
import VoilaFrame from './VoilaFrame';
interface TransactionNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  timeRange?: string;
  entityAccountId: string;
}

const TransactionNetworkTab: React.FC<TransactionNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange = '30d',
  entityAccountId,
}) => {
  const queryParams = React.useMemo(
    () => ({ accountId: entityAccountId, timeRange }),
    [entityAccountId, timeRange],
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
