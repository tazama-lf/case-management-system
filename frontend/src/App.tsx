import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './features/auth/components/AuthContext';
import { QueryProvider } from './shared/providers/QueryProvider';
import { NotificationProvider } from './shared/providers/NotificationProvider';
import { ToastProvider } from './shared/providers/ToastProvider';
import { SkipToContent } from './shared/components/ui/AccessibilityComponents';
import { router } from './router';
import './index.css';

function App(): JSX.Element {
  return (
    <QueryProvider>
      <NotificationProvider>
        <ToastProvider>
          <AuthProvider>
            <SkipToContent targetId="main-content" />
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </NotificationProvider>
    </QueryProvider>
  );
}

export default App;
