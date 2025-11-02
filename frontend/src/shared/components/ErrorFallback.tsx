import React from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
  showRetry?: boolean;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  title = "Something went wrong",
  message,
  showRetry = true
}) => {
  const getErrorMessage = () => {
    if (message) return message;

    if (error?.message) {
      if (error.message.includes('Network Error') || error.message.includes('fetch')) {
        return "Unable to connect to the server. Please check your internet connection and try again.";
      }
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return "Your session has expired. Please refresh the page and log in again.";
      }
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return "You don't have permission to perform this action.";
      }
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return "The requested resource was not found.";
      }
      if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        return "A server error occurred. Please try again later or contact support if the problem persists.";
      }

      return error.message;
    }

    return "An unexpected error occurred. Please try again.";
  };

  return (
    <div className="min-h-96 flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {title}
        </h3>

        <p className="text-sm text-gray-600 mb-6">
          {getErrorMessage()}
        </p>

        {showRetry && resetError && (
          <button
            onClick={resetError}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Try Again
          </button>
        )}

        {process.env.NODE_ENV === 'development' && error?.stack && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Show Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-gray-500 bg-gray-50 p-3 rounded border overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorFallback;
