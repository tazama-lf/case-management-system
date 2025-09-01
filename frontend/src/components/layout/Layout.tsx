import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { NAVIGATION_ITEMS } from '../../constants/navigation';
import type { LayoutProps } from '../../types/navigation.types';

const Layout: React.FC<LayoutProps> = ({ children, title, breadcrumbs }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock user for now
  const user = {
    user_id: 'user-123',
    username: 'john.doe',
    email: 'john.doe@tazama.org',
    name: 'John Doe',
    initials: 'JD',
    tenantId: 'tenant-123',
    roles: ['investigator', 'analyst'] as string[],
    permissions: ['read:alerts', 'write:cases', 'read:analytics'],
  };

  const handleLogout = () => {
    // Remove auth token from localStorage
    localStorage.removeItem('authToken');
    // Redirect to login
    window.location.href = '/login';
  };

  const handleNavigate = (_href: string) => {
    // Navigation is handled by React Router
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-900/80" aria-hidden="true" />
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <Sidebar
          navigation={NAVIGATION_ITEMS}
          user={user}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={user}
          breadcrumbs={breadcrumbs}
          title={title}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children || <Outlet />}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
