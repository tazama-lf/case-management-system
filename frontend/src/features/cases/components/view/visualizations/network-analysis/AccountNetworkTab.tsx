import React from 'react';
import VoilaFrame from './VoilaFrame';

interface AccountNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  timeRange?: string;
  entityId?: string;
}

const AccountNetworkTab: React.FC<AccountNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange,
  entityId,
}) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const tenantId = user?.tenantId || 'DEFAULT';
  const queryParams = React.useMemo(
    () => ({
      entity_id: entityId || '',
      tenantId,
      timeRange: timeRange || 'month',
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
