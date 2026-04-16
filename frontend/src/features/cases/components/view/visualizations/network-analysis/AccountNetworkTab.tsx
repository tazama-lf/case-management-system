import React from 'react';
import VoilaFrame from './VoilaFrame';

interface AccountNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  timeRange?: string;
  entityId?: string;
  tenantId: string;
}

const AccountNetworkTab: React.FC<AccountNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange,
  entityId,
  tenantId,
}) => {
  const queryParams = React.useMemo(
    () => ({
      entity_id: entityId || '',
      tenantId,
      granularity: timeRange || 'month',
    }),
    [entityId, tenantId, timeRange],
  );

  return (
    <VoilaFrame
      notebookPath="account-network.ipynb"
      title="Account Network Analysis"
      queryParams={queryParams}
    />
  );
};

export default AccountNetworkTab;
