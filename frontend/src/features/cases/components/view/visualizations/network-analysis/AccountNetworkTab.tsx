import React from 'react';
import NetworkGraph from './NetworkGraph';
import type { NetworkNodeData } from './NetworkGraph';
import NetworkLegend from './NetworkLegend';
import { accountNetworkLegend } from './legendConfigs';
import NetworkDetailsPanel from './NetworkDetailsPanel';
import {
  generateAccountNetworkNodes,
  generateAccountNetworkEdges,
} from './mockData';

interface AccountNetworkTabProps {
  caseId?: string;
  transactionId?: string;
}

const AccountNetworkTab: React.FC<AccountNetworkTabProps> = ({
  caseId: _caseId,
  transactionId,
}) => {
  const nodes = React.useMemo(
    () => generateAccountNetworkNodes(transactionId),
    [transactionId]
  );
  const edges = React.useMemo(() => generateAccountNetworkEdges(), []);

  const [selectedNode, setSelectedNode] = React.useState<NetworkNodeData | null>(
    () => nodes.find((n) => n.isCenter) || null
  );

  const handleNodeClick = (node: NetworkNodeData) => {
    setSelectedNode(node);
  };

  // Calculate network summary
  const linkedAccounts = nodes.filter((n) => n.type === 'account').length;
  const alertAccounts = nodes.filter(
    (n) => n.status === 'alert' || n.status === 'flagged'
  ).length;

  const detailFields = selectedNode
    ? selectedNode.type === 'counterparty'
      ? [
          { label: 'Counterparty ID', value: selectedNode.id },
          { label: 'Name', value: selectedNode.label.replace('...', '') },
          { label: 'Type', value: selectedNode.sublabel || 'Business' },
        ]
      : [
          { label: 'Account ID', value: selectedNode.id },
          { label: 'Name', value: selectedNode.label },
          { label: 'Role', value: selectedNode.sublabel || 'Account Holder' },
        ]
    : [];

  const summaryFields = [
    { label: 'Linked Accounts', value: linkedAccounts },
    { label: 'Total Transactions', value: 207 },
    { label: 'Total Value', value: '$2,713,000' },
    { label: 'Accounts with Alerts', value: alertAccounts, highlight: alertAccounts > 0 },
  ];

  return (
    <div className="flex h-[450px]">
      {/* Graph Area */}
      <div className="relative flex-1">
        <NetworkGraph
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedNode?.id}
        />
        <NetworkLegend items={accountNetworkLegend} />
      </div>

      {/* Details Panel */}
      <NetworkDetailsPanel
        title={selectedNode?.type === 'counterparty' ? 'Counterparty Details' : 'Account Details'}
        fields={detailFields}
        summaryTitle="Network Summary"
        summaryFields={summaryFields}
      />
    </div>
  );
};

export default AccountNetworkTab;
