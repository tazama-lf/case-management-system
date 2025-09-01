import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { QueryProvider } from './providers/QueryProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { SkipToContent } from './components/accessibility/AccessibilityComponents';
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
