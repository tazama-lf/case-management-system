import React from 'react';
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

import {
  WorkQueueErrorBoundary,
  DefaultWorkQueueErrorFallback,
  useWorkQueueErrorHandler,
  withWorkQueueErrorHandling,
} from '../WorkQueueErrorBoundary';
import { FlowableError } from '../../utils/flowableErrorHandler';

// A test component that can throw an error
const BuggyComponent = ({ shouldThrow, errorMessage = 'Test Error' }: { shouldThrow: boolean; errorMessage?: string }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>Happy Child Content</div>;
};

// A test component for the useWorkQueueErrorHandler hook
const HookUserComponent = () => {
  const { hasError, error, resetErrorBoundary, triggerError } = useWorkQueueErrorHandler();

  if (hasError) {
    return (
      <div data-testid="hook-error-display">
        Error from hook: {error?.message}
        <button onClick={resetErrorBoundary} data-testid="hook-reset-button">Reset Hook</button>
      </div>
    );
  }

  return (
    <button onClick={() => triggerError(new Error('Hook Triggered Error'))} data-testid="hook-trigger-button">
      Trigger Hook Error
    </button>
  );
};

describe('WorkQueueErrorBoundary', () => {
  // Suppress console.error output from React's error boundary in tests
  // This prevents tests from being noisy due to React error logs.
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn(); // Mock console.error
  });

  afterEach(() => {
    console.error = originalError; // Restore console.error
  });

  // 2. Tests for the Happy Path (render children)
  test('should render children when there is no error', () => {
    render(
      <WorkQueueErrorBoundary>
        <BuggyComponent shouldThrow={false} />
      </WorkQueueErrorBoundary>
    );

    expect(screen.getByText('Happy Child Content')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  // 3. Tests for catching a Standard Error
  test('should display a generic error message for a standard error', () => {
    render(
      <WorkQueueErrorBoundary>
        <BuggyComponent shouldThrow={true} />
      </WorkQueueErrorBoundary>
    );

    // Default fallback should be shown with the error message
    expect(screen.getByText('Work Queue Error')).toBeInTheDocument();
    expect(screen.getByText('Test Error')).toBeInTheDocument();
  });

  // 4. Tests for catching a FlowableError (checking if technical details are shown)
  test('should display specific error message and technical details for a FlowableError', () => {
    const thrownError = new FlowableError(
      'Flowable error message',
      'FLOWABLE_ERROR',
      500,
      { errorCode: 'SOME_CODE' },
    );

    const ThrowingComponent = () => {
      throw thrownError;
    };

    render(
      <WorkQueueErrorBoundary>
        <ThrowingComponent />
      </WorkQueueErrorBoundary>
    );

    // Header and message from FlowableError
    expect(screen.getByText('Work Queue Error')).toBeInTheDocument();
    expect(
      screen.getByText('Flowable error message', { exact: false }),
    ).toBeInTheDocument();

    // Technical details section is rendered for FlowableError instances
    expect(screen.getByText('Technical Details')).toBeInTheDocument();
    expect(screen.getByText(/Type:/i)).toBeInTheDocument();
  });

  // 5. Tests for the Reset/Retry functionality
  test('should call reset and retry handlers from the fallback UI', () => {
    const mockReset = vi.fn();
    const mockRetry = vi.fn();

    render(
      <DefaultWorkQueueErrorFallback
        error={new Error('Test Error')}
        resetError={mockReset}
        retry={mockRetry}
      />,
    );

    // Buttons are rendered
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reset View')).toBeInTheDocument();

    // Clicking "Try Again" should call retry handler
    fireEvent.click(screen.getByText('Try Again'));
    expect(mockRetry).toHaveBeenCalledTimes(1);

    // Clicking "Reset View" should call reset handler
    fireEvent.click(screen.getByText('Reset View'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});

describe('useWorkQueueErrorHandler', () => {
  // 6. Tests for the custom Hook 'useWorkQueueErrorHandler'.
  test('should initialize with no error', () => {
    const { result } = renderHook(() => useWorkQueueErrorHandler());

    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should set error state when triggerError is called', () => {
    const { result } = renderHook(() => useWorkQueueErrorHandler());
    const testError = new Error('Hook Test Error');

    act(() => {
      result.current.triggerError(testError);
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.error).toBeInstanceOf(FlowableError);
    expect(result.current.error?.message).toBe('Hook Test Error');
  });

  test('should reset error state when resetErrorBoundary is called', () => {
    const { result } = renderHook(() => useWorkQueueErrorHandler());
    const testError = new Error('Hook Test Error');

    act(() => {
      result.current.triggerError(testError);
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.error).toBeInstanceOf(FlowableError);
    expect(result.current.error?.message).toBe('Hook Test Error');

    act(() => {
      result.current.resetErrorBoundary();
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should integrate and display error in a component', () => {
    render(<HookUserComponent />);

    expect(screen.queryByTestId('hook-error-display')).not.toBeInTheDocument();
    expect(screen.getByTestId('hook-trigger-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-trigger-button'));

    expect(screen.getByTestId('hook-error-display')).toBeInTheDocument();
    expect(screen.getByText('Error from hook: Hook Triggered Error')).toBeInTheDocument();
    expect(screen.queryByTestId('hook-trigger-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-reset-button'));

    expect(screen.queryByTestId('hook-error-display')).not.toBeInTheDocument();
    expect(screen.getByTestId('hook-trigger-button')).toBeInTheDocument();
  });
});

describe('withWorkQueueErrorHandling', () => {
  // A simple component to wrap with the HOC
  const WrappedComponent = ({ showContent = true, shouldThrow = false, message = 'Wrapped Content' }: { showContent?: boolean, shouldThrow?: boolean, message?: string }) => {
    if (shouldThrow) {
      throw new Error('Error from Wrapped Component');
    }
    return showContent ? <div data-testid="wrapped-content">{message}</div> : null;
  };

  // 7. Tests for the HOC 'withWorkQueueErrorHandling'.
  test('should render the wrapped component in the happy path', () => {
    const ComponentWithHandling = withWorkQueueErrorHandling(WrappedComponent);
    render(<ComponentWithHandling />);

    expect(screen.getByTestId('wrapped-content')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  test('should catch errors from the wrapped component and display the error UI', () => {
    // Temporarily suppress console.error for this specific test as well,
    // as the HOC will render the ErrorBoundary which logs errors.
    const originalError = console.error;
    console.error = vi.fn();

    const ComponentWithHandling = withWorkQueueErrorHandling(WrappedComponent);
    render(<ComponentWithHandling shouldThrow={true} />);

    expect(screen.queryByTestId('wrapped-content')).not.toBeInTheDocument();
    expect(screen.getByText('Work Queue Error')).toBeInTheDocument();
    expect(screen.getByText('Error from Wrapped Component')).toBeInTheDocument();

    console.error = originalError; // Restore console.error
  });

  test('HOC displayName should be set correctly', () => {
    const ComponentWithHandling = withWorkQueueErrorHandling(WrappedComponent);
    expect(ComponentWithHandling.displayName).toBe('WithWorkQueueErrorHandling(WrappedComponent)');

    // Test with an anonymous component
    const AnonymousComponent = withWorkQueueErrorHandling(() => <div>Anon</div>);
    expect(AnonymousComponent.displayName).toBe('WithWorkQueueErrorHandling(Component)'); // Fallback to 'Component'
  });
});