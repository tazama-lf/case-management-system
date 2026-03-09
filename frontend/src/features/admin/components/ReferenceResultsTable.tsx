import React from 'react';
import type { ReferenceIdsData } from '@/features/admin/types/admindashboard.types';
import { TablePagination, type TablePaginationInfo } from '@/shared';

interface ReferenceResultTableProps {
  data: ReferenceIdsData[];
  pagination?: TablePaginationInfo;
}

const ReferenceResultsTable: React.FC<ReferenceResultTableProps> = ({
  data,
  pagination,
}) => (
  <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              txTp
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Reference ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created at
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((data) => (
            <tr key={data.id.toString()} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {data.id.toString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {data.txTp}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-600">
                  {data.referenceIdName}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-600">{data.createdAt}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {data.length === 0 && (
      <div className="text-center py-8 text-gray-500">
        No reference records found matching your search criteria.
      </div>
    )}

    {pagination && (
      <TablePagination pagination={pagination} itemLabel="work queues" />
    )}
  </div>
);

export default ReferenceResultsTable;
