import React from 'react';
import NetworkGraph from './NetworkGraph';
import type { NetworkNodeData } from './NetworkGraph';
import NetworkLegend from './NetworkLegend';
import { transactionNetworkLegend } from './legendConfigs';
import NetworkDetailsPanel from './NetworkDetailsPanel';
import {
  generateTransactionNetworkNodes,
  generateTransactionNetworkEdges,
} from './mockData';

interface TransactionNetworkTabProps {
  caseId?: string;
  transactionId?: string;
}

const TransactionNetworkTab: React.FC<TransactionNetworkTabProps> = ({
  caseId,
  transactionId: _transactionId,
}) => {
  const nodes = React.useMemo(
    () => generateTransactionNetworkNodes(caseId),
    [caseId]
  );
  const edges = React.useMemo(() => generateTransactionNetworkEdges(), []);

  const [selectedNode, setSelectedNode] = React.useState<NetworkNodeData | null>(
    () => nodes.find((n) => n.isCenter) || null
  );

  const handleNodeClick = (node: NetworkNodeData) => {
    setSelectedNode(node);
  };

  // Calculate network summary
  const connectedAccounts = nodes.length;
  const outboundConnections = edges.filter((e) => e.type === 'outbound').length;
  const inboundConnections = edges.filter((e) => e.type === 'inbound').length;
  const alertAccounts = nodes.filter(
    (n) => n.status === 'alert' || n.status === 'flagged'
  ).length;

  const detailFields = selectedNode
    ? [
        { label: 'Account ID', value: selectedNode.id },
        { label: 'Account Holder', value: selectedNode.label },
      ]
    : [];

  const summaryFields = [
    { label: 'Connected Accounts', value: connectedAccounts },
    { label: 'Outbound Connections', value: outboundConnections },
    { label: 'Inbound Connections', value: inboundConnections },
    { label: 'Accounts with Alerts', value: alertAccounts, highlight: alertAccounts > 0 },
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
        <NetworkLegend items={transactionNetworkLegend} />
      </div>

      {/* Details Panel */}
      <NetworkDetailsPanel
        title="Center Account"
        fields={detailFields}
        summaryTitle="Network Summary"
        summaryFields={summaryFields}
      />
    </div>
  );
};

export default TransactionNetworkTab;
