import React from 'react';
import type { WorkQueue } from '@/features/admin/types/admindashboard.types';
import { TablePagination, type TablePaginationInfo } from '@/shared';

interface AdminWorkQueuesTableProps {
  queues: WorkQueue[];
  pagination?: TablePaginationInfo;
}

const AdminWorkQueuesTable: React.FC<AdminWorkQueuesTableProps> = ({
  queues,
  pagination,
}) => (
  <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Group ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Group Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {queues.map((queue) => (
            <tr key={queue.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {queue.id}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {queue.name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-600">{queue.type}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {queues.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No work queues found matching your search criteria.
      </div>
    )}

    {pagination && (
      <TablePagination pagination={pagination} itemLabel="work queues" />
    )}
  </div>
);

export default AdminWorkQueuesTable;
