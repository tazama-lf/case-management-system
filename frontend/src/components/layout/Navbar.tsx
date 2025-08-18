import React, { useState } from 'react';
import {
  PlusIcon,
  HomeIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  ChartBarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  current?: boolean;
  badge?: number;
}

interface User {
  name: string;
  email: string;
  avatar?: string;
  initials: string;
}

interface NavbarProps {
  user?: User;
  onNavigate?: (href: string) => void;
  onLogout?: () => void;
  onCreateCase?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  user = { name: 'John Doe', email: 'john.doe@tazama.org', initials: 'JD' },
  onNavigate,
  onLogout,
  onCreateCase,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navigation: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, current: true },
    { name: 'Alerts', href: '/alerts', icon: ExclamationTriangleIcon, badge: 12 },
    { name: 'Cases', href: '/cases', icon: FolderIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Team', href: '/team', icon: UserGroupIcon },
  ];

  const handleNavigation = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    }
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left section */}
          <div className="flex items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <span className="ml-3 text-xl font-semibold text-gray-900 hidden sm:block">
                Tazama CMS
              </span>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <span className="text-gray-600 font-medium text-sm">
                      {user.initials}
                    </span>
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleNavigation('/profile');
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <UserGroupIcon className="h-4 w-4 mr-3" />
                      Your Profile
                    </button>
                    <button
                      onClick={() => {
                        handleNavigation('/settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      Settings
                    </button>
                    <div className="border-t border-gray-100"></div>
                    <button
                      onClick={() => {
                        if (onLogout) onLogout();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                className={`
                  flex items-center w-full px-3 py-2 rounded-md text-base font-medium transition-colors
                  ${item.current
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
            
            {/* Mobile Create Case Button */}
            <button
              onClick={() => {
                if (onCreateCase) onCreateCase();
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full px-3 py-2 mt-4 bg-blue-600 text-white rounded-md font-medium"
            >
              <PlusIcon className="h-5 w-5 mr-3" />
              New Case
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
