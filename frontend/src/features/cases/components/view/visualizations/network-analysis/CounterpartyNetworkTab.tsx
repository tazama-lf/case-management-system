import React from 'react';
import VoilaFrame from './VoilaFrame';

interface CounterpartyNetworkTabProps {
  caseId?: number;
  transactionId?: string;
  entityId: string;
}

const CounterpartyNetworkTab: React.FC<CounterpartyNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
  entityId,
}) => (
  <VoilaFrame
    notebookPath="counterparty-network.ipynb"
    title="Counterparty Network Analysis"
    queryParams={{ entityId }}
  />
);

export default CounterpartyNetworkTab;
