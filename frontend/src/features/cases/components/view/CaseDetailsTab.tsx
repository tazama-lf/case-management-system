import React from 'react';
import { PencilIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from '../CasesTable';

interface CaseDetailsTabProps {
  row: CaseRow;
}

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    {title ? <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div> : null}
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const CaseDetailsTab: React.FC<CaseDetailsTabProps> = ({ row }) => {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Case Information */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">Case Information</div>
        <SectionCard>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <div className="text-gray-500">Creation Date</div>
              <div className="font-medium text-gray-900">2024-01-15 09:30:00</div>
            </div>
            <div>
              <div className="text-gray-500">Assignment Date</div>
              <div className="font-medium text-gray-900">2024-01-15 09:45:00</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <span className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${row.statusColor}`}>
                {row.status}
              </span>
            </div>
            <div>
              <div className="text-gray-500">Priority</div>
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex w-fit items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">Medium</span>
                <button className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Edit Priority">
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Creditor Information */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">Creditor Information</div>
        <SectionCard>
          <div className="grid grid-cols-2 gap-y-3">
            <div className="text-gray-500">Name</div>
            <div className="text-gray-900">Alex Ross</div>
            <div className="text-gray-500">Account ID</div>
            <div className="text-gray-900">EA34280043165</div>
            <div className="text-gray-500">FSP</div>
            <div className="text-gray-900">Bank of America</div>
          </div>
        </SectionCard>
      </div>

      {/* Block/Allow List Status */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">Block/Allow List Status</div>
        <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option>Not Listed</option>
          <option>Allow Listed</option>
          <option>Block Listed</option>
        </select>
      </div>

      {/* Debtor Information */}
      <div className="space-y-3 md:col-span-2">
        <div className="text-sm font-semibold text-gray-700">Debtor Information</div>
        <SectionCard>
          <div className="grid grid-cols-2 gap-y-3">
            <div className="text-gray-500">Name</div>
            <div className="text-gray-900">Casey Howard</div>
            <div className="text-gray-500">Account ID</div>
            <div className="text-gray-900">EA34282929743</div>
            <div className="text-gray-500">FSP</div>
            <div className="text-gray-900">Bank of America</div>
          </div>
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3 md:col-span-2">
        <div className="text-sm font-semibold text-gray-700">Recent Activity</div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <ClockIcon className="mt-0.5 h-4 w-4 text-gray-400" />
            <div>
              Alert Triage task completed by John Smith
              <div className="text-xs text-gray-500">9/5/2025, 9:06:55 AM</div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-sm text-gray-700">
            <ClockIcon className="mt-0.5 h-4 w-4 text-gray-400" />
            <div>
              Investigation task started by Sarah Johnson
              <div className="text-xs text-gray-500">9/5/2025, 9:06:55 AM</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDetailsTab;
