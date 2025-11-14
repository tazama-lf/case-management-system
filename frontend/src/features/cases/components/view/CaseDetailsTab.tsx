import React from 'react';
import type { CaseRow } from '../casesTable.utils';
import type { TaskForSupervisor } from '../../services/taskService';

interface CaseDetailsTabProps {
  row: CaseRow;
  tasks?: TaskForSupervisor[];
  loadingTasks?: boolean;
}

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    {title ? (
      <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
    ) : null}
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    NEW: 'bg-blue-50 text-blue-700 ring-blue-200',
    URGENT: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    CRITICAL: 'bg-orange-50 text-orange-700 ring-orange-200',
    BREACH: 'bg-red-50 text-red-700 ring-red-200',
  };
  return priorityColors[priority] || 'bg-gray-50 text-gray-700 ring-gray-200';
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-red-600 bg-red-50';
  if (score >= 60) return 'text-orange-600 bg-orange-50';
  if (score >= 40) return 'text-yellow-600 bg-yellow-50';
  if (score > 0) return 'text-green-600 bg-green-50';
  return 'text-gray-600 bg-gray-50';
};

const CaseDetailsTab: React.FC<CaseDetailsTabProps> = ({ row, tasks = [], loadingTasks = false }) => {
  // Extract transaction data
  const getTransactionData = () => {
    if (!row.transaction) return null;

    try {
      const txData = row.transaction as Record<string, unknown>;
      const fiToFIPmtSts = txData?.FIToFIPmtSts as Record<string, unknown>;
      return fiToFIPmtSts?.TxInfAndSts as Record<string, unknown> | null;
    } catch {
      return null;
    }
  };

  const transactionData = getTransactionData();

  const getNestedValue = (
    obj: Record<string, unknown> | null,
    path: string[],
  ): string => {
    if (!obj) return 'N/A';
    let current: unknown = obj;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return 'N/A';
      }
    }
    return typeof current === 'string' ? current : 'N/A';
  };

  const creditorFsp = getNestedValue(transactionData, [
    'InstdAgt',
    'FinInstnId',
    'ClrSysMmbId',
    'MmbId',
  ]);
  const debtorFsp = getNestedValue(transactionData, [
    'InstgAgt',
    'FinInstnId',
    'ClrSysMmbId',
    'MmbId',
  ]);

  const getTaskStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      STATUS_01_UNASSIGNED: 'bg-gray-50 text-gray-700 ring-gray-200',
      STATUS_10_ASSIGNED: 'bg-blue-50 text-blue-700 ring-blue-200',
      STATUS_20_IN_PROGRESS: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
      STATUS_21_BLOCKED: 'bg-orange-50 text-orange-700 ring-orange-200',
      STATUS_30_COMPLETED: 'bg-green-50 text-green-700 ring-green-200',
    };
    return statusColors[status] || 'bg-gray-50 text-gray-700 ring-gray-200';
  };

  const formatTaskStatus = (status: string): string => {
    const statusLabels: Record<string, string> = {
      STATUS_01_UNASSIGNED: 'Unassigned',
      STATUS_10_ASSIGNED: 'Assigned',
      STATUS_20_IN_PROGRESS: 'In Progress',
      STATUS_21_BLOCKED: 'Blocked',
      STATUS_30_COMPLETED: 'Completed',
    };
    return statusLabels[status] || status;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Case Information */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">
            Case Information
          </div>
          <SectionCard>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase">Case ID</div>
                <div className="font-medium text-gray-900">{row.id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Case Type</div>
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${row.typeColor}`}
                >
                  {row.type || 'N/A'}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Status</div>
                <span
                  className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${row.statusColor}`}
                >
                  {row.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Priority</div>
                <div className="inline-flex items-center gap-2">
                  <span
                    className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(row.priority)}`}
                  >
                    {row.priority}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Created On
                </div>
                <div className="font-medium text-gray-900">{row.createdOn}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Picked On</div>
                <div className="font-medium text-gray-900">{row.pickedOn}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Assignee</div>
                <div className="font-medium text-gray-900">
                  {row.assignee || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Total Tasks
                </div>
                <div className="font-medium text-gray-900">
                  {row.totalTasks}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Alert Information */}
        {row.alertId && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Alert Information
            </div>
            <SectionCard>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Alert ID
                  </div>
                  <div className="font-medium text-gray-900">{row.alertId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Confidence Score
                  </div>
                  <div
                    className={`inline-flex px-2 py-1 text-sm font-bold rounded-full ${getScoreColor(row.confidencePercent || 0)}`}
                  >
                    {row.confidencePercent || 0}%
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 uppercase">Message</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {row.alertMessage || 'N/A'}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Creditor Information */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">
          Creditor Information
        </div>
        <SectionCard>
          <div className="grid grid-cols-2 gap-y-3">
            <div className="text-gray-500">FSP ID</div>
            <div className="text-gray-900 font-mono">{creditorFsp}</div>
          </div>
        </SectionCard>
      </div>

      {/* Debtor Information */}
      <div className="space-y-3 md:col-span-2">
        <div className="text-sm font-semibold text-gray-700">
          Debtor Information
        </div>
        <SectionCard>
          <div className="grid grid-cols-2 gap-y-3">
            <div className="text-gray-500">FSP ID</div>
            <div className="text-gray-900 font-mono">{debtorFsp}</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default CaseDetailsTab;
