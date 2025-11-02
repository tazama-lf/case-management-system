import React from 'react';

interface AlertsTableSkeletonProps {
  rows?: number;
}

const AlertsTableSkeleton: React.FC<AlertsTableSkeletonProps> = ({ rows = 5 }) => {
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      {}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-32 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-24 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-28 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-24 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-32 animate-pulse"></div>
        </div>
      </div>

      {}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="px-6 py-4">
            <div className="flex items-center space-x-4">
              {}
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>

              {}
              <div className="h-4 bg-blue-200 rounded w-24 animate-pulse"></div>

              {}
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>

              {}
              <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>

              {}
              <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse"></div>

              {}
              <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>

              {}
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>

              {}
              <div className="flex space-x-2">
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {}
      <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-8 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-8 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-8 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsTableSkeleton;
