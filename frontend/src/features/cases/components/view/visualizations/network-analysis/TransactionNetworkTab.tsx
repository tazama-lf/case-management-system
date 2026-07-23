import React from 'react';
import VoilaFrame from './VoilaFrame';
interface TransactionNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  timeRange: string;
  tenantId: string;
  entityAccountId: string;
}

const TransactionNetworkTab: React.FC<TransactionNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange,
  tenantId,
  entityAccountId,
}) => {
  const queryParams = React.useMemo(
    () => ({ accountId: entityAccountId, granularity: timeRange, tenantId }),
    [entityAccountId, timeRange, tenantId],
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
