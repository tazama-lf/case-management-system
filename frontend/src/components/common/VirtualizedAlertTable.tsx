import React, { useMemo } from 'react';
import { FixedSizeList } from 'react-window';
import type { Alert } from '../../types/triage.types';

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
      case 'CRITICAL':
        return 'text-red-600 bg-red-50';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50';
      case 'LOW':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'NEW':
        return 'text-blue-600 bg-blue-50';
      case 'INVESTIGATING':
        return 'text-yellow-600 bg-yellow-50';
      case 'CLOSED':
        return 'text-gray-600 bg-gray-50';
      case 'CONVERTED':
        return 'text-green-600 bg-green-50';
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

      {/* Status */}
      <div className="flex-shrink-0 w-28">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(alert.alert_status)}`}>
          {alert.alert_status}
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

      {/* Virtualized List */}
      <FixedSizeList
        height={height}
        itemCount={alerts.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5}
      >
        {AlertRow}
      </FixedSizeList>
    </div>
  );
};

export default VirtualizedAlertTable;
