import React from 'react';
import VoilaFrame from './VoilaFrame';

interface AccountNetworkTabProps {
  caseId?: number;
  transactionId?: string;
}

const AccountNetworkTab: React.FC<AccountNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
}) => (
  <VoilaFrame
    notebookPath="account-network.ipynb"
    title="Account Network Analysis"
  />
);

export default AccountNetworkTab;
