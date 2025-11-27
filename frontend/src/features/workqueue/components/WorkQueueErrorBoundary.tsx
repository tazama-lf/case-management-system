import React from 'react';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  FlowableError,
  createErrorMessage,
} from '../utils/flowableErrorHandler';

interface WorkQueueErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<WorkQueueErrorFallbackProps>;
}

export interface WorkQueueErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retry?: () => void;
}

interface WorkQueueErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WorkQueueErrorBoundary extends React.Component<
  WorkQueueErrorBoundaryProps,
  WorkQueueErrorBoundaryState
> {
  constructor(props: WorkQueueErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WorkQueueErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      'Work Queue Error Boundary caught an error:',
      error,
      errorInfo,
    );
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent =
        this.props.fallback || DefaultWorkQueueErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export const DefaultWorkQueueErrorFallback: React.FC<
  WorkQueueErrorFallbackProps
> = ({ error, resetError, retry }) => {
  const errorInfo = createErrorMessage(error, 'Failed to load work queue');

  return (
    <div className="min-h-96 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div className="text-center px-6 py-8 max-w-md">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />

        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Work Queue Error
        </h3>

        <p className="text-sm text-gray-600 mb-4">{errorInfo.message}</p>

        {errorInfo.actionSuggestion && (
          <p className="text-xs text-gray-500 mb-6 italic">
            {errorInfo.actionSuggestion}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {errorInfo.canRetry && (
            <button
              onClick={retry || resetError}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Try Again
            </button>
          )}

          <button
            onClick={resetError}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Reset View
          </button>
        </div>

        {error instanceof FlowableError && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 font-mono">
              <div>
                <strong>Type:</strong> {error.type}
              </div>
              {error.statusCode && (
                <div>
                  <strong>Status:</strong> {error.statusCode}
                </div>
              )}
              <div>
                <strong>Timestamp:</strong>{' '}
                {new Date(error.timestamp).toLocaleString()}
              </div>
              {error.originalError && (
                <div className="mt-2">
                  <strong>Details:</strong>
                  <pre className="mt-1 whitespace-pre-wrap">
                    {JSON.stringify(error.originalError, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export const useWorkQueueErrorHandler = () => {
  const [error, setError] = React.useState<FlowableError | null>(null);

  const handleError = React.useCallback((err: unknown) => {
    if (err instanceof FlowableError) {
      setError(err);
    } else if (err instanceof Error) {
      setError(new FlowableError(err.message, 'UNKNOWN_ERROR'));
    } else {
      setError(
        new FlowableError('An unexpected error occurred', 'UNKNOWN_ERROR'),
      );
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Backwards compatible helpers expected by existing tests/components
  const triggerError = React.useCallback(
    (err: unknown) => {
      handleError(err);
    },
    [handleError],
  );

  const resetErrorBoundary = React.useCallback(() => {
    clearError();
  }, [clearError]);

  const getErrorDisplay = React.useCallback(() => {
    if (!error) return null;
    return createErrorMessage(error);
  }, [error]);

  return {
    error,
    hasError: error !== null,
    handleError,
    clearError,
    getErrorDisplay,
    // Legacy-style API used in tests
    triggerError,
    resetErrorBoundary,
  };
};

export function withWorkQueueErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  customFallback?: React.ComponentType<WorkQueueErrorFallbackProps>,
) {
  const WithErrorHandling = (props: P) => (
    <WorkQueueErrorBoundary fallback={customFallback}>
      <Component {...props} />
    </WorkQueueErrorBoundary>
  );

  WithErrorHandling.displayName = `WithWorkQueueErrorHandling(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WithErrorHandling;
}

export default WorkQueueErrorBoundary;
