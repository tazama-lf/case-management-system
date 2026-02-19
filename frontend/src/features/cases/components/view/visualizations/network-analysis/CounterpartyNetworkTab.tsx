import React from 'react';
import type { NetworkNodeData } from './NetworkGraph';
import {
  generateCounterpartyNetworkNodes,
} from './mockData';

interface CounterpartyNetworkTabProps {
  caseId?: number;
  transactionId?: string;
}

const CounterpartyNetworkTab: React.FC<CounterpartyNetworkTabProps> = ({
  caseId: _caseId,
  transactionId,
}) => {
  const nodes = React.useMemo(
    () => generateCounterpartyNetworkNodes(transactionId),
    [transactionId],
  );

  const [selectedNode, setSelectedNode] =
    React.useState<NetworkNodeData | null>(
      () => nodes.find((n) => n.isCenter) || null,
    );

  return (
    <div className="flex h-[750px] w-full flex-col bg-white p-4">
      <iframe
        src={`${import.meta.env.VITE_VOILA_BASE_URL}/voila/render/counterparty-network.ipynb`}
        className="h-full w-full border-0"
        title="Counterparty Network Analysis"
      />
    </div>
  );
};

export default CounterpartyNetworkTab;
