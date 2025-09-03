import React, { useMemo } from 'react';
// import { List } from 'react-window';
import type { Alert } from '../types/triage.types';

interface VirtualizedAlertTableProps {
  alerts: Alert[];
  height?: number;
  itemHeight?: number;
  onRowClick?: (alert: Alert) => void;
  selectedAlertId?: string;
  onSelectAlert?: (alert: Alert) => void;
  className?: string;
}

interface AlertRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    alerts: Alert[];
    onRowClick?: (alert: Alert) => void;
    selectedAlertId?: string;
    onSelectAlert?: (alert: Alert) => void;
  };
}

const AlertRow: React.FC<AlertRowProps> = ({ index, style, data }) => {
  const { alerts, onRowClick, selectedAlertId, onSelectAlert } = data;
  const alert = alerts[index];

  if (!alert) return null;

  const isSelected = selectedAlertId === alert.alert_id;

  const handleClick = () => {
    onRowClick?.(alert);
    onSelectAlert?.(alert);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'BREACH':
        return 'text-red-600 bg-red-50';
      case 'CRITICAL':
        return 'text-red-600 bg-red-50';
      case 'URGENT':
        return 'text-orange-600 bg-orange-50';
      case 'NEW':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeColor = (alertType: string | null | undefined) => {
    if (!alertType) return 'text-gray-600 bg-gray-50';
    
    switch (alertType.toUpperCase()) {
      case 'FRAUD_DETECTION':
        return 'text-red-600 bg-red-50';
      case 'SANCTIONS_SCREENING':
        return 'text-orange-600 bg-orange-50';
      case 'AML_SCREENING':
        return 'text-purple-600 bg-purple-50';
      case 'TRANSACTION_MONITORING':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      style={style}
      role="row"
      tabIndex={0}
      aria-selected={isSelected}
      onKeyDown={handleKeyDown}
      className={`
        flex items-center px-6 py-3 border-b border-gray-200 cursor-pointer
        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
        ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white'}
      `}
      onClick={handleClick}
    >
      {/* Alert ID */}
      <div className="flex-shrink-0 w-32">
        <span className="text-sm font-medium text-gray-900 truncate">
          {alert.alert_id}
        </span>
      </div>

      {/* Priority */}
      <div className="flex-shrink-0 w-24">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(alert.priority)}`}>
          {alert.priority}
        </span>
      </div>

      {/* Alert Type */}
      <div className="flex-shrink-0 w-28">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(alert.alert_type)}`}>
          {alert.alert_type || 'N/A'}
        </span>
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0 mx-4">
        <p className="text-sm text-gray-900 truncate">
          {alert.message}
        </p>
      </div>

      {/* Source */}
      <div className="flex-shrink-0 w-24">
        <span className="text-sm text-gray-500 truncate">
          {alert.source || 'N/A'}
        </span>
      </div>

      {/* Confidence */}
      <div className="flex-shrink-0 w-20 text-right">
        <span className="text-sm text-gray-900">
          {alert.confidence_per ? `${alert.confidence_per}%` : 'N/A'}
        </span>
      </div>

      {/* Created Date */}
      <div className="flex-shrink-0 w-36 text-right">
        <span className="text-sm text-gray-500">
          {formatDate(alert.created_at)}
        </span>
      </div>
    </div>
  );
};

const VirtualizedAlertTable: React.FC<VirtualizedAlertTableProps> = ({
  alerts,
  height = 600,
  itemHeight = 60,
  onRowClick,
  selectedAlertId,
  onSelectAlert,
  className = '',
}) => {
  const itemData = useMemo(() => ({
    alerts,
    onRowClick,
    selectedAlertId,
    onSelectAlert,
  }), [alerts, onRowClick, selectedAlertId, onSelectAlert]);

  if (alerts.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center`} style={{ height }}>
        <div className="text-gray-500 text-center">
          <p className="text-lg font-medium">No alerts found</p>
          <p className="text-sm">Try adjusting your filters or search criteria</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Table Header */}
      <div className="flex items-center px-6 py-3 bg-gray-50 border-b border-gray-200 font-medium text-sm text-gray-900">
        <div className="flex-shrink-0 w-32">Alert ID</div>
        <div className="flex-shrink-0 w-24">Priority</div>
        <div className="flex-shrink-0 w-28">Status</div>
        <div className="flex-1 min-w-0 mx-4">Message</div>
        <div className="flex-shrink-0 w-24">Source</div>
        <div className="flex-shrink-0 w-20 text-right">Confidence</div>
        <div className="flex-shrink-0 w-36 text-right">Created</div>
      </div>

      {/* Simple List - TODO: Implement virtualization properly */}
      <div style={{ height, overflow: 'auto' }}>
        {alerts.map((alert, index) => (
          <div key={alert.alert_id || index} style={{ height: itemHeight }}>
            <AlertRow 
              index={index} 
              style={{ height: itemHeight }}
              data={itemData}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualizedAlertTable;
