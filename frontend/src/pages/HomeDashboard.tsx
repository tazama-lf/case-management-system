import React from 'react';
import {
  ExclamationTriangleIcon,
  FolderIcon,
  UserGroupIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../components';

interface DashboardCardData {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  hoverColor: string;
  href: string;
}

interface HomeDashboardProps {
  onLogout: () => void;
}

const HomeDashboard: React.FC<HomeDashboardProps> = ({ onLogout }) => {
  const dashboardCards: DashboardCardData[] = [
    {
      id: 'alerts',
      title: 'Alerts Dashboard',
      description: 'Monitor and manage security alerts and financial crime notifications',
      icon: ExclamationTriangleIcon,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      hoverColor: 'hover:bg-red-100',
      href: '/alerts',
    },
    {
      id: 'cases',
      title: 'Cases Dashboard',
      description: 'Track and manage investigation cases and their progress',
      icon: FolderIcon,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      href: '/cases',
    },
    {
      id: 'supervisor',
      title: 'Supervisor Dashboard',
      description: 'Oversee team performance and case assignments',
      icon: UserGroupIcon,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverColor: 'hover:bg-green-100',
      href: '/supervisor',
    },
    {
      id: 'admin',
      title: 'Admin Dashboard',
      description: 'System administration and user management',
      icon: CogIcon,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100',
      href: '/admin',
    },
  ];

  const handleCardClick = (href: string) => {
    console.log('Navigate to:', href);
    // TODO: Implement actual navigation
  };

  const handleLogout = () => {
    console.log('Logout clicked');
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {/* Left side - Title and subtitle */}
            <div>
              <h3 className="text-3xl font-semibold text-gray-900">
                Investigation Platform
              </h3>
              <p className="text-lg text-gray-600 mt-2">
                Select a dashboard to begin your investigation
              </p>
            </div>
            
            {/* Right side - Logout button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Simple 4-Card Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {dashboardCards.map((card) => (
            <Card
              key={card.id}
              title={card.title}
              description={card.description}
              icon={card.icon}
              iconColor={card.iconColor}
              bgColor={card.bgColor}
              hoverColor={card.hoverColor}
              onClick={() => handleCardClick(card.href)}
              className="w-full"
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default HomeDashboard;
