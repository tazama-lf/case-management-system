import React from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data available',
  message = 'There is no data to display at the moment.',
  actionLabel,
  onAction,
  icon,
  className = '',
}) => {
  const defaultIcon = <InboxIcon className="w-8 h-8 text-gray-400" />;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}
    >
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          {icon ?? defaultIcon}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
