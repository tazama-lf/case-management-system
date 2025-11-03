import React from 'react';
import { ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ErrorStateProps {
  /**
   * Error message to display
   */
  message?: string;
  /**
   * Error title/heading
   */
  title?: string;
  /**
   * Whether to show a retry button
   */
  showRetry?: boolean;
  /**
   * Retry function to call when retry button is clicked
   */
  onRetry?: () => void;
  /**
   * Size variant for the error component
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Custom className for additional styling
   */
  className?: string;
  /**
   * Whether this is a critical error (affects styling)
   */
  severity?: 'error' | 'warning' | 'info';
}

const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'An unexpected error occurred',
  title = 'Error Loading Data',
  showRetry = true,
  onRetry,
  size = 'medium',
  className = '',
  severity = 'error'
}) => {
  const sizeClasses = {
    small: {
      container: 'p-4',
      icon: 'h-8 w-8',
      title: 'text-base',
      message: 'text-sm',
      button: 'px-3 py-1.5 text-sm'
    },
    medium: {
      container: 'p-6',
      icon: 'h-10 w-10',
      title: 'text-lg',
      message: 'text-base',
      button: 'px-4 py-2 text-sm'
    },
    large: {
      container: 'p-8',
      icon: 'h-12 w-12',
      title: 'text-xl',
      message: 'text-lg',
      button: 'px-6 py-3 text-base'
    }
  };

  const severityClasses = {
    error: {
      background: 'bg-red-50 border-red-200',
      icon: 'text-red-500',
      title: 'text-red-900',
      message: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700 text-white'
    },
    warning: {
      background: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-500',
      title: 'text-yellow-900',
      message: 'text-yellow-700',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white'
    },
    info: {
      background: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-500',
      title: 'text-blue-900',
      message: 'text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  };

  const currentSize = sizeClasses[size];
  const currentSeverity = severityClasses[severity];

  return (
    <div className={`border rounded-lg ${currentSeverity.background} ${currentSize.container} ${className}`}>
      <div className="flex flex-col items-center text-center">
        <ExclamationCircleIcon className={`${currentSize.icon} ${currentSeverity.icon} mb-3`} />
        
        <h3 className={`font-semibold ${currentSeverity.title} ${currentSize.title} mb-2`}>
          {title}
        </h3>
        
        <p className={`${currentSeverity.message} ${currentSize.message} mb-4`}>
          {message}
        </p>

        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className={`
              inline-flex items-center
              ${currentSize.button}
              ${currentSeverity.button}
              font-medium rounded-md 
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50
            `}
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;