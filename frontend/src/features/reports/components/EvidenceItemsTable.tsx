import React from 'react';
import type { EvidenceItem } from '../types/reports.types';

interface EvidenceItemsTableProps {
  data: EvidenceItem[];
  isLoading?: boolean;
}

const EvidenceItemsTable: React.FC<EvidenceItemsTableProps> = ({
  data,
  isLoading = false,
}) => {
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-green-50 text-green-700 ring-green-600/20';
      case 'Refuted':
        return 'bg-red-50 text-red-700 ring-red-600/20';
      case 'Inconclusive':
        return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-600/20';
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Evidence Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Count
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Percentage
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.length > 0 ? (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {item.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {item.count}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="flex items-center">
                      <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeColor(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No evidence items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EvidenceItemsTable;
