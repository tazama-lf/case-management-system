import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationProvider, useNotifications } from '../NotificationProvider';

const mockToastSuccess = vi.fn((message, options) => `success-${message}`);
const mockToastError = vi.fn((message, options) => `error-${message}`);
const mockToastLoading = vi.fn((message, options) => `loading-${message}`);
const mockToastDismiss = vi.fn();
const mockToastFn = vi.fn((message, options) => `toast-${message}`);

// Assign methods to the function
Object.assign(mockToastFn, {
  success: mockToastSuccess,
  error: mockToastError,
  loading: mockToastLoading,
  dismiss: mockToastDismiss,
});

vi.mock('react-hot-toast', () => {
  const mockToast = vi.fn((message, options) => `toast-${message}`);
  const mockSuccess = vi.fn();
  const mockError = vi.fn();
  const mockLoading = vi.fn();
  const mockDismiss = vi.fn();

  Object.assign(mockToast, {
    success: mockSuccess,
    error: mockError,
    loading: mockLoading,
    dismiss: mockDismiss,
  });

  return {
    default: mockToast,
    Toaster: () => <div data-testid="toaster">Toaster</div>,
  };
});

import toast from 'react-hot-toast';

describe('NotificationProvider', () => {
  const TestComponent = () => {
    const { showSuccess, showError, showWarning, showInfo, showLoading, dismiss } =
      useNotifications();

    return (
      <div>
        <button onClick={() => showSuccess('Success message')}>Show Success</button>
        <button onClick={() => showError('Error message')}>Show Error</button>
        <button onClick={() => showWarning('Warning message')}>Show Warning</button>
        <button onClick={() => showInfo('Info message')}>Show Info</button>
        <button onClick={() => showLoading('Loading message')}>Show Loading</button>
        <button onClick={() => dismiss('toast-id')}>Dismiss</button>
        <button
          onClick={() =>
            showSuccess('Custom success', { duration: 5000, position: 'bottom-right' })
          }
        >
          Show Custom Success
        </button>
      </div>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides notification context to children', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    expect(screen.getByText('Show Success')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('calls toast.success when showSuccess is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Show Success');
    act(() => {
      button.click();
    });

    expect((toast as any).success).toHaveBeenCalledWith('Success message', {
      duration: 4000,
      position: 'top-right',
    });
  });

  it('calls toast.error when showError is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Show Error');
    act(() => {
      button.click();
    });

    expect((toast as any).error).toHaveBeenCalledWith('Error message', {
      duration: 6000,
      position: 'top-right',
    });
  });

  it('calls toast with warning style when showWarning is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Show Warning');
    act(() => {
      button.click();
    });

    expect((toast as any).success).not.toHaveBeenCalled();
    expect((toast as any).error).not.toHaveBeenCalled();
    // toast is called directly for warning
    expect(toast).toHaveBeenCalledWith('Warning message', {
      duration: 5000,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#ffffff',
      },
    });
  });

  it('calls toast with info style when showInfo is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Show Info');
    act(() => {
      button.click();
    });

    expect((toast as any).success).not.toHaveBeenCalled();
    expect((toast as any).error).not.toHaveBeenCalled();
    // toast is called directly for info
    expect(toast).toHaveBeenCalledWith('Info message', {
      duration: 4000,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#ffffff',
      },
    });
  });

  it('calls toast.loading when showLoading is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Show Loading');
    act(() => {
      button.click();
    });

    expect((toast as any).loading).toHaveBeenCalledWith('Loading message', {
      position: 'top-right',
    });
  });

  it('calls toast.dismiss when dismiss is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Dismiss');
    act(() => {
      button.click();
    });

    expect((toast as any).dismiss).toHaveBeenCalledWith('toast-id');
  });

  it('allows custom options to override defaults', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const button = screen.getByText('Show Custom Success');
    act(() => {
      button.click();
    });

    expect((toast as any).success).toHaveBeenCalledWith('Custom success', {
      duration: 5000,
      position: 'bottom-right',
    });
  });

  it('throws error when useNotifications is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestComponent = () => {
      useNotifications();
      return <div>Test</div>;
    };

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useNotifications must be used within a NotificationProvider');

    consoleSpy.mockRestore();
  });
});

