import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { NAVIGATION_ITEMS } from '@/shared/constants/navigation';
import { useAuth } from '@/features/auth/components/AuthContext';
import type { LayoutProps } from '@/shared/types/navigation.types';

const Layout: React.FC<LayoutProps> = ({ children, title, breadcrumbs }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const handleNavigate = (_href: string) => {};

  return (
    <div className="h-screen flex bg-gray-50">
      {}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-900/80" aria-hidden="true" />
        </div>
      )}

      {}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <Sidebar
          navigation={NAVIGATION_ITEMS}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>

      {}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={user as any}
          breadcrumbs={breadcrumbs}
          title={title}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {}
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children || <Outlet />}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
