import React from 'react';

interface AccountNetworkTabProps {
  caseId?: string;
  transactionId?: string;
}

const AccountNetworkTab: React.FC<AccountNetworkTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
}) => {
  // Embed the Jupyter notebook as an iframe using the shared component
  return (
    <div className="flex h-[750px] w-full flex-col bg-white p-4">
      <iframe
        src={`${import.meta.env.VITE_VOILA_BASE_URL}/voila/render/account-network.ipynb`}
        className="h-full w-full border-0"
        title="Account Network Analysis"
      />
    </div>
  );
};

export default AccountNetworkTab;
