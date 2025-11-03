import React from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Breadcrumb from './Breadcrumb';
import type { HeaderProps } from '../../types/navigation.types';

interface HeaderComponentProps extends HeaderProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

const Header: React.FC<HeaderComponentProps> = ({
  user,
  breadcrumbs,
  title,
  sidebarOpen,
  setSidebarOpen,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {}
          <div className="flex items-center md:hidden">
            {setSidebarOpen && (
              <button
                type="button"
                className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <span className="sr-only">Toggle sidebar</span>
                {sidebarOpen ? (
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                )}
              </button>
            )}
          </div>

          
          <div className="flex flex-1 items-center lg:ml-0">
            <div className="hidden lg:block">
              {title ? (
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {title}
                  </h1>
                  {breadcrumbs && (
                    <Breadcrumb items={breadcrumbs} className="mt-1" />
                  )}
                </div>
              ) : (
                <Breadcrumb items={breadcrumbs} />
              )}
            </div>
          </div>

      
          <div className="flex items-center gap-x-4 lg:gap-x-6">
           
            <div className="hidden lg:flex lg:items-center lg:gap-x-3">
              <div className="h-9 w-9 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-white">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
                    : user?.username?.slice(0, 2).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-sm leading-tight">
                <div className="font-semibold text-gray-900">
                  {user?.fullName || 
                   (user?.firstName && user?.lastName 
                     ? `${user.firstName} ${user.lastName}` 
                     : user?.username || 'User')}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email || 
                   (user?.roles && user.roles.length > 0 
                     ? user.roles[0].replace(/_/g, ' ').replace(/-/g, ' ')
                     : 'User')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="lg:hidden pb-4">
          {title && (
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {title}
            </h1>
          )}
          <Breadcrumb items={breadcrumbs} />
        </div>
      </div>
    </header>
  );
};

export default Header;
