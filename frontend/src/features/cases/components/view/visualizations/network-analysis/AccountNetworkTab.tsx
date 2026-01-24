import React from 'react';
import JupyterVisualization from '../shared/JupyterVisualization';

interface AccountNetworkTabProps {
  caseId?: string;
  transactionId?: string;
}

const AccountNetworkTab: React.FC<AccountNetworkTabProps> = ({ caseId, transactionId }) => {
  // Embed the Jupyter notebook as an iframe using the shared component
  return (
    <div className="flex min-h-[400px] p-4">
      <div className="w-full">
        <JupyterVisualization
          notebook="account-network.ipynb"
          params={{ caseId: caseId || '', transactionId: transactionId || '' }}
          height="700px"
          title="Account Network Notebook"
        />
      </div>
    </div>
  );
};

export default AccountNetworkTab;
