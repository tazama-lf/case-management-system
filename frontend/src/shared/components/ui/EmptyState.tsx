import React from 'react';
import {
  ExclamationCircleIcon,
  DocumentIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: 'document' | 'folder' | 'exclamation' | React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = 'document',
  action,
  className = '',
}) => {
  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }

    const iconClasses = 'mx-auto h-12 w-12 text-gray-400';

    switch (icon) {
      case 'folder':
        return <FolderIcon className={iconClasses} />;
      case 'exclamation':
        return <ExclamationCircleIcon className={iconClasses} />;
      case 'document':
      default:
        return <DocumentIcon className={iconClasses} />;
    }
  };

  const getActionClasses = () => {
    const baseClasses =
      'inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium';

    if (action?.variant === 'secondary') {
      return `${baseClasses} border-gray-300 text-gray-700 bg-white hover:bg-gray-50`;
    }

    return `${baseClasses} border-transparent text-white bg-blue-600 hover:bg-blue-700`;
  };

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex flex-col items-center">
        {renderIcon()}
        <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-gray-500 max-w-sm">{description}</p>
        )}
        {action && (
          <div className="mt-6">
            <button
              type="button"
              onClick={action.onClick}
              className={getActionClasses()}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
