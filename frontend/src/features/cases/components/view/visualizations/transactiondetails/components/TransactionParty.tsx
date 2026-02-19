import React from 'react';
import { UserCircleIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

interface TransactionPartyProps {
  type: 'debtor' | 'creditor';
  name: string;
  account: string;
  address: string;
  country: string;
  riskLevel: string;
}

export const TransactionParty: React.FC<TransactionPartyProps> = ({
  type,
  name,
  account,
  address,
  country,
  riskLevel,
}) => {
  const getRiskColor = (risk: string): string => {
    if (risk === 'High') return 'text-red-600 bg-red-50';
    if (risk === 'Medium') return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const Icon = type === 'debtor' ? UserCircleIcon : BuildingOfficeIcon;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3 mb-3">
        <Icon className="h-5 w-5 text-gray-400" />
        <h4 className="font-medium text-gray-900 capitalize">{type}</h4>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <div className="text-xs text-gray-500 uppercase font-medium">Name</div>
          <div className="text-gray-900">{name}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase font-medium">Account</div>
          <div className="text-gray-900 font-mono">{account}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase font-medium">Address</div>
          <div className="text-gray-900">{address}</div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase font-medium">Country</div>
            <div className="text-gray-900">{country}</div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(riskLevel)}`}>
            {riskLevel} Risk
          </div>
        </div>
      </div>
    </div>
  );
};
