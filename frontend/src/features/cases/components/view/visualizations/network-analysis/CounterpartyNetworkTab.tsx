import React from 'react';
import VoilaFrame from './VoilaFrame';

interface CounterpartyNetworkTabProps {
  caseId?: number;
  transactionId?: string;
}

const CounterpartyNetworkTab: React.FC<CounterpartyNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
}) => (
  <VoilaFrame
    notebookPath="counterparty-network.ipynb"
    title="Counterparty Network Analysis"
  />
);

export default CounterpartyNetworkTab;
