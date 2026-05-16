import React, { createContext, useContext } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { Alert, ActionHistory } from '../types/triage.types';
import { formatDate } from '@/shared/utils/dateUtils';

interface AlertDetailsContextType {
  alert: Alert | null;
  actionHistory: ActionHistory[];
  isLoading: boolean;
  onClose: () => void;
  onUpdate?: (alert: Alert) => void;
  onCloseAlert?: (alert: Alert) => void;
}

const AlertDetailsContext = createContext<AlertDetailsContextType | null>(null);

const useAlertDetailsContext = () => {
  const context = useContext(AlertDetailsContext);
  if (!context) {
    throw new Error(
      'Alert details components must be used within AlertDetails.Root',
    );
  }
  return context;
};

interface AlertDetailsRootProps {
  alert: Alert | null;
  actionHistory?: ActionHistory[];
  isLoading?: boolean;
  onClose: () => void;
  onUpdate?: (alert: Alert) => void;
  onCloseAlert?: (alert: Alert) => void;
  children: React.ReactNode;
  className?: string;
}

const AlertDetailsRoot: React.FC<AlertDetailsRootProps> = ({
  alert,
  actionHistory = [],
  isLoading = false,
  onClose,
  onUpdate,
  onCloseAlert,
  children,
  className = '',
}) => {
  const contextValue: AlertDetailsContextType = {
    alert,
    actionHistory,
    isLoading,
    onClose,
    onUpdate,
    onCloseAlert,
  };

  if (!alert && !isLoading) {
    return null;
  }

  return (
    <AlertDetailsContext.Provider value={contextValue}>
      <div className={`bg-white rounded-lg shadow-lg ${className}`}>
        {children}
      </div>
    </AlertDetailsContext.Provider>
  );
};

interface AlertDetailsHeaderProps {
  className?: string;
  showCloseButton?: boolean;
}

const AlertDetailsHeader: React.FC<AlertDetailsHeaderProps> = ({
  className = '',
  showCloseButton = true,
}) => {
  const { alert, onClose, isLoading } = useAlertDetailsContext();

  if (isLoading) {
    return (
      <div className={`p-6 border-b border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!alert) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'BREACH':
        return 'text-red-600 bg-red-100';
      case 'CRITICAL':
        return 'text-red-600 bg-red-100';
      case 'URGENT':
        return 'text-orange-600 bg-orange-100';
      case 'NEW':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`p-6 border-b border-gray-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              Alert Details
            </h2>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(alert.priority)}`}
          >
            {alert.priority}
          </span>
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close alert details"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>
      <div className="mt-2">
        <p className="text-sm text-gray-600">
          Alert ID:{' '}
          <span className="font-mono font-medium">{alert.alert_id}</span>
        </p>
      </div>
    </div>
  );
};

interface AlertDetailsContentProps {
  className?: string;
  sections?: Array<'basic' | 'message' | 'data' | 'transaction' | 'network'>;
}

const AlertDetailsContent: React.FC<AlertDetailsContentProps> = ({
  className = '',
  sections = ['basic', 'message', 'data', 'transaction', 'network'],
}) => {
  const { alert, isLoading } = useAlertDetailsContext();

  if (isLoading) {
    return (
      <div className={`p-6 space-y-6 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!alert) return null;

  const renderJSONData = (data: unknown, title: string) => {
    if (!data) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {sections.includes('basic') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Alert Type
              </label>
              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                {alert.alert_type ?? 'N/A'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Source
              </label>
              <p className="text-sm text-gray-900">{alert.source ?? 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <p className="text-sm text-gray-900">
                {alert.alert_type ?? 'N/A'}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confidence
              </label>
              <p className="text-sm text-gray-900">
                {alert.confidence_per ? `${alert.confidence_per}%` : 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Created
              </label>
              <p className="text-sm text-gray-900">
                {formatDate(alert.created_at)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Case ID
              </label>
              <p className="text-sm text-gray-900">{alert.case_id ?? 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {sections.includes('message') && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Message</h4>
          <div className="bg-gray-50 p-4 rounded border">
            <p className="text-sm text-gray-700">
              {alert.message || 'No message available'}
            </p>
          </div>
        </div>
      )}

      {sections.includes('data') &&
        renderJSONData(alert.alert_data, 'Alert Data')}
      {sections.includes('transaction') &&
        renderJSONData(alert.transaction, 'Transaction Data')}
      {sections.includes('network') &&
        renderJSONData(alert.network_map, 'Network Map')}
    </div>
  );
};

interface AlertDetailsActionsProps {
  className?: string;
  actions?: Array<'update' | 'close'>;
}

const AlertDetailsActions: React.FC<AlertDetailsActionsProps> = ({
  className = '',
  actions = ['update', 'close'],
}) => {
  const { alert, onUpdate, onCloseAlert } = useAlertDetailsContext();

  if (!alert) return null;

  const canUpdate = actions.includes('update') && onUpdate;
  const canClose = actions.includes('close') && onCloseAlert;

  if (!canUpdate && !canClose) {
    return null;
  }

  return (
    <div className={`p-6 border-t border-gray-200 bg-gray-50 ${className}`}>
      <div className="flex justify-end space-x-3">
        {canUpdate && (
          <button
            onClick={() => {
              onUpdate(alert);
            }}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Update Alert
          </button>
        )}
        {}
        {canClose && (
          <button
            onClick={() => {
              onCloseAlert(alert);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Close Alert
          </button>
        )}
      </div>
    </div>
  );
};

interface AlertDetailsHistoryProps {
  className?: string;
  maxItems?: number;
}

const AlertDetailsHistory: React.FC<AlertDetailsHistoryProps> = ({
  className = '',
  maxItems = 10,
}) => {
  const { actionHistory, isLoading } = useAlertDetailsContext();

  if (isLoading) {
    return (
      <div className={`p-6 border-t border-gray-200 ${className}`}>
        <h4 className="text-sm font-medium text-gray-900 mb-4">
          Action History
        </h4>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-2 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!actionHistory || actionHistory.length === 0) {
    return (
      <div className={`p-6 border-t border-gray-200 ${className}`}>
        <h4 className="text-sm font-medium text-gray-900 mb-4">
          Action History
        </h4>
        <p className="text-sm text-gray-500">No action history available</p>
      </div>
    );
  }

  const displayedHistory = actionHistory.slice(0, maxItems);

  // Helper function to extract username from action_performed string
  const extractUsername = (actionPerformed: string): string | null => {
    const match = actionPerformed.match(/Triaged by user (.+)$/);
    return match ? match[1] : null;
  };

  return (
    <div className={`p-6 border-t border-gray-200 ${className}`}>
      <h4 className="text-sm font-medium text-gray-900 mb-4">Action History</h4>
      <div className="space-y-3">
        {displayedHistory.map((action) => {
          const username = extractUsername(action.action_performed);
          return (
            <div key={action.audit_log_id} className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <ClockIcon className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{action.operation}</span>
                  {action.action_performed && ` - ${action.action_performed}`}
                </p>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{new Date(action.performed_at).toLocaleString()}</span>
                  {username && (
                    <>
                      <span>•</span>
                      <span className="font-medium">User: {username}</span>
                    </>
                  )}
                </div>
                {action.outcome && (
                  <p className="text-xs text-gray-600 mt-1">{action.outcome}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {actionHistory.length > maxItems && (
        <div className="mt-4">
          <button className="text-sm text-blue-600 hover:text-blue-800">
            View all {actionHistory.length} actions
          </button>
        </div>
      )}
    </div>
  );
};

export const AlertDetails = {
  Root: AlertDetailsRoot,
  Header: AlertDetailsHeader,
  Content: AlertDetailsContent,
  Actions: AlertDetailsActions,
  History: AlertDetailsHistory,
};
