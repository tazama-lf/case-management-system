import React from 'react';
import NetworkGraph from './NetworkGraph';
import type { NetworkNodeData } from './NetworkGraph';
import NetworkLegend from './NetworkLegend';
import { counterpartyNetworkLegend } from './legendConfigs';
import NetworkDetailsPanel from './NetworkDetailsPanel';
import {
  generateCounterpartyNetworkNodes,
  generateCounterpartyNetworkEdges,
} from './mockData';

interface CounterpartyNetworkTabProps {
  caseId?: string;
  transactionId?: string;
}

const CounterpartyNetworkTab: React.FC<CounterpartyNetworkTabProps> = ({
  caseId: _caseId,
  transactionId,
}) => {
  const nodes = React.useMemo(
    () => generateCounterpartyNetworkNodes(transactionId),
    [transactionId]
  );
  const edges = React.useMemo(() => generateCounterpartyNetworkEdges(), []);

  const [selectedNode, setSelectedNode] = React.useState<NetworkNodeData | null>(
    () => nodes.find((n) => n.isCenter) || null
  );

  const handleNodeClick = (node: NetworkNodeData) => {
    setSelectedNode(node);
  };

  // Calculate network summary
  const totalCounterparties = nodes.length;
  const outboundConnections = edges.filter((e) => e.type === 'outbound').length;
  const inboundConnections = edges.filter((e) => e.type === 'inbound').length;
  const highRiskCounterparties = nodes.filter(
    (n) => n.status === 'alert' || n.status === 'flagged'
  ).length;

  const detailFields = selectedNode
    ? [
        { label: 'Counterparty ID', value: selectedNode.id },
        { label: 'Name', value: selectedNode.label },
        { label: 'Type', value: selectedNode.sublabel || 'Counterparty' },
      ]
    : [];

  const summaryFields = [
    { label: 'Total Counterparties', value: totalCounterparties },
    { label: 'Outbound Links', value: outboundConnections },
    { label: 'Inbound Links', value: inboundConnections },
    { label: 'High Risk', value: highRiskCounterparties, highlight: highRiskCounterparties > 0 },
  ];

  return (
    <div className="flex min-h-[400px] p-4">
      {/* Graph Area */}
      <div className="relative flex-1 min-h-[650px]">
        <NetworkGraph
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedNode?.id}
        />
        <NetworkLegend items={counterpartyNetworkLegend} />
      </div>

      {/* Details Panel */}
      <NetworkDetailsPanel
        title="Counterparty Details"
        fields={detailFields}
        summaryTitle="Network Summary"
        summaryFields={summaryFields}
      />
    </div>
  );
};

export default CounterpartyNetworkTab;
