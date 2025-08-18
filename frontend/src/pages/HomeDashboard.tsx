import React from 'react';
import {
  ExclamationTriangleIcon,
  FolderIcon,
  UserGroupIcon,
  CogIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

interface DashboardCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  hoverColor: string;
  href: string;
}

const HomeDashboard: React.FC = () => {
  const dashboardCards: DashboardCard[] = [
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tazama Case Management System
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose your dashboard to manage alerts, cases, and investigations effectively
          </p>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {dashboardCards.map((card) => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.href)}
              className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-gray-300 ${card.hoverColor} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              {/* Icon Section */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-lg ${card.bgColor} mb-6`}>
                <card.icon className={`h-8 w-8 ${card.iconColor}`} />
              </div>

              {/* Content Section */}
              <div className="text-left">
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-gray-800">
                  {card.title}
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {card.description}
                </p>
              </div>

              {/* Arrow Icon */}
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <ArrowRightIcon className="h-5 w-5 text-gray-400" />
              </div>

              {/* Hover Effect Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-50 opacity-0 group-hover:opacity-50 transition-opacity duration-200 pointer-events-none" />
            </button>
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center mt-16">
          <p className="text-sm text-gray-500">
            Welcome to the Tazama Financial Crime Investigation Platform
          </p>
        </div>
      </main>
    </div>
  );
};

export default HomeDashboard;
