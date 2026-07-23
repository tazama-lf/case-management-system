import React from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationProps {
  id?: string;
  type: NotificationType;
  title: string;
  message?: string;
  autoClose?: boolean;
  duration?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const getNotificationStyles = (type: NotificationType) => {
  const styles = {
    success: {
      container: 'bg-green-50 border-green-200',
      icon: 'text-green-400',
      title: 'text-green-800',
      message: 'text-green-700',
      iconComponent: CheckCircleIcon,
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      message: 'text-red-700',
      iconComponent: XCircleIcon,
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      iconComponent: ExclamationTriangleIcon,
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      message: 'text-blue-700',
      iconComponent: InformationCircleIcon,
    },
  };
  return styles[type];
};

export const Notification: React.FC<NotificationProps> = ({
  type,
  title,
  message,
  autoClose = true,
  duration = 5000,
  onClose,
  action,
}) => {
  const styles = getNotificationStyles(type);
  const IconComponent = styles.iconComponent;

  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className={`rounded-md border p-4 ${styles.container}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <IconComponent
            className={`h-5 w-5 ${styles.icon}`}
            aria-hidden="true"
          />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${styles.title}`}>{title}</h3>
          {message && (
            <div className={`mt-2 text-sm ${styles.message}`}>
              <p>{message}</p>
            </div>
          )}
          {action && (
            <div className="mt-4">
              <div className="-mx-2 -my-1.5 flex">
                <button
                  type="button"
                  onClick={action.onClick}
                  className={`rounded-md px-2 py-1.5 text-sm font-medium ${styles.title} hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent`}
                >
                  {action.label}
                </button>
              </div>
            </div>
          )}
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex rounded-md p-1.5 ${styles.icon} hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent`}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export interface ToastNotification extends NotificationProps {
  id: string;
}

interface NotificationContainerProps {
  notifications: ToastNotification[];
  onRemove: (id: string) => void;
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

const getPositionStyles = (position: string) => {
  const positions = {
    'top-right': 'top-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'top-center': 'top-0 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-0 left-1/2 transform -translate-x-1/2',
  };
  return (
    positions[position as keyof typeof positions] || positions['top-right']
  );
};

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemove,
  position = 'top-right',
}) => {
  if (notifications.length === 0) return null;

  return (
    <div
      className={`fixed z-50 p-6 space-y-4 ${getPositionStyles(position)}`}
      style={{ maxWidth: '420px', width: '100%' }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="transform transition-all duration-300 ease-in-out"
        >
          <Notification
            {...notification}
            onClose={() => {
              onRemove(notification.id);
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default Notification;
