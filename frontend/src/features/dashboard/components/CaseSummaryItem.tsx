import React from 'react';
import type { CaseSummary } from '../types/dashboard.types';

interface CaseSummaryItemProps {
  case: CaseSummary;
}

const CaseSummaryItem: React.FC<CaseSummaryItemProps> = ({
  case: caseItem,
}) => {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'Assigned to you';
      case 'pending':
        return 'Pending review';
      case 'closed':
        return 'Recently closed';
      default:
        return 'Cases';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'text-blue-600';
      case 'pending':
        return 'text-yellow-600';
      case 'closed':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex-1">
        <p className={`text-sm font-medium ${getStatusColor(caseItem.status)}`}>
          {getStatusLabel(caseItem.status)}
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-lg font-semibold text-gray-900">
          {caseItem.count}
        </span>
        <span className="text-sm text-gray-600">{caseItem.description}</span>
      </div>
    </div>
  );
};

export default CaseSummaryItem;
