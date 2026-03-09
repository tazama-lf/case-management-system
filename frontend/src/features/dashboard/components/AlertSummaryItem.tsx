import React from 'react';
import type { AlertSummary } from '../types/dashboard.types';

interface AlertSummaryItemProps {
  alert: AlertSummary;
}

const AlertSummaryItem: React.FC<AlertSummaryItemProps> = ({ alert }) => {
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'High priority alerts';
      case 'medium':
        return 'Medium priority alerts';
      case 'low':
        return 'Low priority alerts';
      default:
        return 'Alerts';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${getPriorityColor(alert.priority)}`}
        >
          {getPriorityLabel(alert.priority)}
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-lg font-semibold text-gray-900">
          {alert.count}
        </span>
        <span className="text-sm text-gray-600">{alert.description}</span>
      </div>
    </div>
  );
};

export default AlertSummaryItem;
