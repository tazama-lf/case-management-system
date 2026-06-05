import React from 'react';
import type { AlertSummary } from '../types/dashboard.types';

interface AlertSummaryItemProps {
  summary: AlertSummary;
}

const AlertSummaryItem: React.FC<AlertSummaryItemProps> = ({ summary }) => {
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

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${getPriorityColor(summary.priority)}`}
        >
          {getPriorityLabel(summary.priority)}
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-lg font-semibold text-gray-900">
          {summary.count}
        </span>
        <span className="text-sm text-gray-600">{summary.description}</span>
      </div>
    </div>
  );
};

export default AlertSummaryItem;
