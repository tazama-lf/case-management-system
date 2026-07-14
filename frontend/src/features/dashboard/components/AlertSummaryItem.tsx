import React from 'react';
import type { AlertSummary } from '../types/dashboard.types';

interface AlertSummaryItemProps {
  summary: AlertSummary;
  /** Highest count among sibling rows, used to size the magnitude bar. Defaults to this row's own count. */
  maxCount?: number;
}

const AlertSummaryItem: React.FC<AlertSummaryItemProps> = ({
  summary,
  maxCount,
}) => {
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'High priority cases';
      case 'Medium':
        return 'Medium priority cases';
      case 'Low':
        return 'Low priority cases';
      default:
        return 'Cases';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600';
      case 'Medium':
        return 'text-yellow-600';
      case 'Low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPriorityDotColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const barMax = maxCount && maxCount > 0 ? maxCount : summary.count || 1;
  const barWidthPct =
    summary.count > 0
      ? Math.max(4, Math.round((summary.count / barMax) * 100))
      : 0;

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${getPriorityDotColor(summary.priority)}`}
          />
          <p
            className={`text-sm font-medium truncate ${getPriorityColor(summary.priority)}`}
          >
            {getPriorityLabel(summary.priority)}
          </p>
        </div>
        <div className="flex items-center space-x-4 flex-shrink-0">
          <span className="text-lg font-semibold text-gray-900">
            {summary.count}
          </span>
          <span className="text-sm text-gray-500">{summary.description}</span>
        </div>
      </div>
      <div className="mt-1.5 ml-3.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getPriorityDotColor(summary.priority)}`}
          style={{ width: `${barWidthPct}%` }}
        />
      </div>
    </div>
  );
};

export default AlertSummaryItem;
