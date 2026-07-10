import React from 'react';
import type { CaseSummary } from '../types/dashboard.types';

interface CaseSummaryItemProps {
  case: CaseSummary;
  /** Highest count among sibling rows, used to size the magnitude bar. Defaults to this row's own count. */
  maxCount?: number;
}

const CaseSummaryItem: React.FC<CaseSummaryItemProps> = ({
  case: caseItem,
  maxCount,
}) => {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'inProgress':
        return 'In Progress';
      case 'assigned':
        return 'Assigned to you';
      case 'pending':
        return 'Pending review';
      case 'closed':
        return 'Recently closed';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'text-blue-600';
      case 'inProgress':
        return 'text-purple-600';
      case 'pending':
        return 'text-yellow-600';
      case 'closed':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBarColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-500';
      case 'inProgress':
        return 'bg-purple-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'closed':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  const barMax = maxCount && maxCount > 0 ? maxCount : caseItem.count || 1;
  const barWidthPct =
    caseItem.count > 0
      ? Math.max(4, Math.round((caseItem.count / barMax) * 100))
      : 0;

  return (
    <div className="py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${getStatusBarColor(caseItem.status)}`}
          />
          <p
            className={`text-sm font-medium truncate ${getStatusColor(caseItem.status)}`}
          >
            {getStatusLabel(caseItem.status)}
          </p>
        </div>
        <div className="flex items-center space-x-4 flex-shrink-0">
          <span className="text-lg font-semibold text-gray-900">
            {caseItem.count}
          </span>
          {caseItem.description && (
            <span className="text-sm text-gray-500">
              {caseItem.description}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1.5 ml-3.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getStatusBarColor(caseItem.status)}`}
          style={{ width: `${barWidthPct}%` }}
        />
      </div>
    </div>
  );
};

export default CaseSummaryItem;
