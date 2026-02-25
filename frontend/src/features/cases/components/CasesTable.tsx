import React from 'react';
import type { CaseRow } from './casesTable.utils';
import {
  getScoreColor,
  getSarStrStatusColor,
  formatSarStrStatus,
} from './casesTable.utils';
import { getCaseStatusBadge } from '@/shared/constants/case.constant';
import { TablePagination, type TablePaginationInfo } from '@/shared';

interface CasesTableProps {
  rows: CaseRow[];
  onView: (row: CaseRow) => void;
  pagination?: TablePaginationInfo;
  isComplianceOfficer?: boolean;
}

const CasesTable: React.FC<CasesTableProps> = ({
  rows,
  onView,
  pagination,
  isComplianceOfficer = false,
}) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span className="hidden sm:inline">Case ID</span>
              <span className="sm:hidden">ID</span>
            </th>

            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span className="hidden lg:inline">Case Type</span>
              <span className="lg:hidden">Type</span>
            </th>

            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>

            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span className="hidden sm:inline">Score</span>
              <span className="sm:hidden">%</span>
            </th>

            {isComplianceOfficer && (
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <span className="hidden lg:inline">SAR/STR Status</span>
                <span className="lg:hidden">SAR/STR</span>
              </th>
            )}

            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Created
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={isComplianceOfficer ? 6 : 5}
                className="px-6 py-12 text-center text-gray-500"
              >
                No cases available.
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  onView(c);
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                  CASE-{c.id}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {c.type || 'N/A'}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-gray-200 ${c.statusColor}`}
                  >
                    {getCaseStatusBadge(c.status)}
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${getScoreColor(
                      c.score,
                    )}`}
                  >
                    {c.score}%
                  </span>
                </td>

                {isComplianceOfficer && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-gray-200 ${getSarStrStatusColor(
                        c.sarStrStatus || 'N/A',
                      )}`}
                    >
                      {formatSarStrStatus(c.sarStrStatus || 'N/A')}
                    </span>
                  </td>
                )}

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {c.createdOn}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {pagination && (
      <TablePagination pagination={pagination} itemLabel="cases" />
    )}
  </div>
);

export default CasesTable;
