import React from 'react';
import VoilaFrame from './VoilaFrame';

interface CounterpartyNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  timeRange: string;
  tenantId: string;
  entityId: string;
}

const CounterpartyNetworkTab: React.FC<CounterpartyNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  timeRange,
  tenantId,
  entityId,
}) => (
  <VoilaFrame
    notebookPath="counterparty-network.ipynb"
    title="Counterparty Network Analysis"
    queryParams={{ entityId, tenantId, granularity: timeRange }}
  />
);

export default CounterpartyNetworkTab;
