import React from 'react';

interface DashboardSectionProps {
  title: string;
  subtitle: string;
  viewAllHref?: string;
  children: React.ReactNode;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  subtitle,
  viewAllHref,
  children,
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {viewAllHref && (
        <a
          href={viewAllHref}
          className="group inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          View all
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            &rarr;
          </span>
        </a>
      )}
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

export default DashboardSection;
