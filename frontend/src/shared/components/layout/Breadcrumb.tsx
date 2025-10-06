import React from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { Link, useLocation } from 'react-router-dom';
import type { BreadcrumbItem } from '../../types/navigation.types';

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  const location = useLocation();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ name: 'Dashboard', href: '/' }];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Capitalize and format segment name
      const name =
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

      breadcrumbs.push({
        name,
        href: isLast ? undefined : currentPath,
        current: isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-4">
        {breadcrumbItems.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <div className="flex items-center">
              {/* {index === 0 && (
                <HomeIcon className="h-5 w-5 flex-shrink-0 text-gray-400 mr-2" aria-hidden="true" />
              )} */}
              {index > 0 && (
                <ChevronRightIcon
                  className="h-5 w-5 flex-shrink-0 text-gray-400 mr-4"
                  aria-hidden="true"
                />
              )}
              {item.href && !item.current ? (
                <Link
                  to={item.href}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className={`text-sm font-medium ${
                    item.current ? 'text-gray-900' : 'text-gray-500'
                  }`}
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.name}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
