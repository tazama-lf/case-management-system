import React from 'react';

interface CasesTableSkeletonProps {
  rows?: number;
}

const CasesTableSkeleton: React.FC<CasesTableSkeletonProps> = ({ rows = 5 }) => {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {}
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-12 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-12 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
              </th>
              <th className="px-6 py-3 text-right">
                <div className="h-4 bg-gray-300 rounded w-16 animate-pulse ml-auto"></div>
              </th>
            </tr>
          </thead>

          {}
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-6 bg-blue-200 rounded-full w-16 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-6 bg-yellow-200 rounded-full w-32 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-6 bg-red-200 rounded-full w-16 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                </td>

                {}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                    <div className="h-8 bg-gray-200 rounded w-18 animate-pulse"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CasesTableSkeleton;
