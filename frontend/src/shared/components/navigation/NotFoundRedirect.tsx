import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/shared/providers/ToastProvider';

interface NotFoundRedirectProps {
  /** Where to send the user instead */
  to: string;
  /** Short heading of the error toast, e.g. "Case not found" */
  title: string;
  message?: string;
}

/**
 * Tells the user the address they opened does not exist, then sends them to a page that does.
 * The toast is raised once per mount, since StrictMode runs effects twice in development.
 */
const NotFoundRedirect: React.FC<NotFoundRedirectProps> = ({
  to,
  title,
  message,
}) => {
  const { error } = useToast();
  const notified = useRef(false);

  useEffect(() => {
    if (notified.current) {
      return;
    }
    notified.current = true;
    error(title, message);
  }, [error, title, message]);

  return <Navigate to={to} replace />;
};

export default NotFoundRedirect;
