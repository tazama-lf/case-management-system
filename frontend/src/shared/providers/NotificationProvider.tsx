import React, { createContext, useContext } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { ToastOptions } from 'react-hot-toast';

interface NotificationContextType {
  showSuccess: (message: string, options?: ToastOptions) => void;
  showError: (message: string, options?: ToastOptions) => void;
  showWarning: (message: string, options?: ToastOptions) => void;
  showInfo: (message: string, options?: ToastOptions) => void;
  showLoading: (message: string) => string;
  dismiss: (toastId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const showSuccess = (message: string, options?: ToastOptions): void => {
    toast.success(message, {
      duration: 4000,
      position: 'top-right',
      ...options,
    });
  };

  const showError = (message: string, options?: ToastOptions): void => {
    toast.error(message, {
      duration: 6000,
      position: 'top-right',
      ...options,
    });
  };

  const showWarning = (message: string, options?: ToastOptions): void => {
    toast(message, {
      duration: 5000,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#ffffff',
      },
      ...options,
    });
  };

  const showInfo = (message: string, options?: ToastOptions): void => {
    toast(message, {
      duration: 4000,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#ffffff',
      },
      ...options,
    });
  };

  const showLoading = (message: string): string =>
    toast.loading(message, {
      position: 'top-right',
    });

  const dismiss = (toastId: string): void => {
    toast.dismiss(toastId);
  };

  const value: NotificationContextType = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    dismiss,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        containerClassName=""
        containerStyle={{}}
        toastOptions={{
          className: '',
          style: {
            maxWidth: '500px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </NotificationContext.Provider>
  );
};
