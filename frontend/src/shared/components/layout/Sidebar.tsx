import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth/components/AuthContext';
import type { SidebarProps, NavItem } from '@/shared/types/navigation.types';

const Sidebar: React.FC<SidebarProps> = ({ navigation, onLogout }) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const {
    hasAdminRole,
    hasCMSAdminRole,
    hasInvestigatorRole,
    hasSupervisorRole,
    hasBackendClaim,
  } = useAuth();

  const hasAccess = (item: NavItem): boolean => {
    if (!item.roles || item.roles.length === 0) return true;

    return item.roles.some((role) => {
      switch (role) {
        case 'CMS_ADMIN':
          return hasCMSAdminRole();
        case 'alert-triage':
          return hasAdminRole(); // Legacy admin role includes alert-triage
        case 'CMS_INVESTIGATOR':
          return hasInvestigatorRole();
        case 'CMS_SUPERVISOR':
          return hasSupervisorRole();
        default:
          return hasBackendClaim(role);
      }
    });
  };

  const isActive = (href: string): boolean => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href],
    );
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    if (!hasAccess(item)) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.href);
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <div className="flex items-center">
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(item.href)}
              className={`
                group flex w-full items-center gap-x-3 rounded-md p-2 text-left text-sm font-semibold leading-6 transition-colors duration-200
                ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }
                ${level > 0 ? 'ml-6' : ''}
              `}
            >
              <Icon
                className={`h-6 w-6 shrink-0 ${
                  active
                    ? 'text-blue-700'
                    : 'text-gray-400 group-hover:text-blue-700'
                }`}
                aria-hidden="true"
              />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className="ml-auto inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                  {item.badge}
                </span>
              )}
              {isExpanded ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
          ) : (
            <Link
              to={item.href}
              className={`
                group flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors duration-200
                ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }
                ${level > 0 ? 'ml-6' : ''}
              `}
            >
              <Icon
                className={`h-6 w-6 shrink-0 ${
                  active
                    ? 'text-blue-700'
                    : 'text-gray-400 group-hover:text-blue-700'
                }`}
                aria-hidden="true"
              />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className="ml-auto inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                  {item.badge}
                </span>
              )}
            </Link>
          )}
        </div>

        {hasChildren && isExpanded && (
          <ul className="mt-1 space-y-1">
            {item
              .children!.filter(hasAccess)
              .map((child) => renderNavItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
      {}
      <div className="flex h-16 shrink-0 items-center">
        <div className="flex items-center">
          {}
          <span className="ml-3 text-xl font-semibold text-gray-900">
            Investigation Platform
          </span>
        </div>
      </div>

      {}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.filter(hasAccess).map((item) => renderNavItem(item))}
            </ul>
          </li>

          {/* User profile section and logout */}
          <li className="mt-auto border-t border-gray-200 pt-4">

            {/* Logout button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="group flex w-full items-center gap-x-3 rounded-md px-2 py-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors duration-200"
              >
                <ArrowRightOnRectangleIcon
                  className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-red-700"
                  aria-hidden="true"
                />
                Logout
              </button>
            )}
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
