import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './features/auth/components/AuthContext';
import { QueryProvider } from './shared/providers/QueryProvider';
import { NotificationProvider } from './shared/providers/NotificationProvider';
import { SkipToContent } from './shared/components/ui/AccessibilityComponents';
import { router } from './router';
import './index.css';

function App() {
  return (
    <QueryProvider>
      <NotificationProvider>
        <AuthProvider>
          <SkipToContent targetId="main-content" />
          <RouterProvider router={router} />
        </AuthProvider>
      </NotificationProvider>
    </QueryProvider>
  );
}

export default App;
