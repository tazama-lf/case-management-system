import React from 'react';
import type { CaseRow } from '../casesTable.utils';
import CaseActionsPanel from './CaseActionsPanel';
import { getCaseStatusBadge } from '@/shared/constants/case.constant';
import type { TransactionHistoryDto } from '../../../alerts/types/triage.types';
import triageService from '../../../alerts/services/triageservice';
import {
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

interface CaseDetailsTabProps {
  row: CaseRow;
  canManageSupervisorActions?: boolean;
  showActions?: boolean;
  onComplete?: (row: CaseRow) => void;
  onCloseCase?: (row: CaseRow) => void;
  onReopenCase?: (row: CaseRow) => void;
  onAbandonCase?: (row: CaseRow) => void;
  onSuspendCase?: (row: CaseRow) => void;
  onResumeCase?: (row: CaseRow) => void;
  onApproveCase?: (row: CaseRow) => void;
  onApproveCaseReopen?: (row: CaseRow) => void;
  onRejectCaseReopen?: (row: CaseRow) => void;
  onApproveCaseCreation?: (row: CaseRow) => void;
  onRejectCaseCreation?: (row: CaseRow) => void;
}

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    {title ? <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div> : null}
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    'NEW': 'bg-blue-50 text-blue-700 ring-blue-200',
    'URGENT': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    'CRITICAL': 'bg-orange-50 text-orange-700 ring-orange-200',
    'BREACH': 'bg-red-50 text-red-700 ring-red-200',
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

const CaseDetailsTab: React.FC<CaseDetailsTabProps> = ({
  row,
  canManageSupervisorActions = false,
  showActions = true,
  onComplete,
  onCloseCase,
  onReopenCase,
  onAbandonCase,
  onSuspendCase,
  onResumeCase,
  onApproveCase,
  onApproveCaseReopen,
  onRejectCaseReopen,
  onApproveCaseCreation,
  onRejectCaseCreation,
}) => {

  const [transactionalData, setTransactionData] = React.useState<TransactionHistoryDto[]>();
  const [openTransactions, setOpenTransactions] = React.useState<Record<string, boolean>>({});
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

  const getNestedValue = (obj: Record<string, unknown> | null, path: string[]): string => {
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

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const syntaxHighlightJson = (obj: unknown) => {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    const escaped = escapeHtml(String(json));

    const highlighted = escaped
      .replace(
        /("(.*?)")(?=\s*:)/g,
        '<span class="text-indigo-700 font-medium">$1</span>',
      )
      .replace(/:\s*"(.*?)"/g, ': <span class="text-green-700">"$1"</span>')
      .replace(
        /(:\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi,
        '$1<span class="text-red-600">$2</span>',
      )
      .replace(
        /(:\s*)(true|false)/gi,
        '$1<span class="text-yellow-600">$2</span>',
      )
      .replace(/(:\s*)(null)/gi, '$1<span class="text-gray-500">$2</span>');

    return highlighted.replace(/\n/g, '<br/>').replace(/ /g, '&nbsp;');
  };

  React.useEffect(() => {
    const fetchTransactionData = async () => {
      if (!row?.alertId) return;

      try {
        const transactionData = await triageService.getAlertTransactionalData(row.alertId);
        setTransactionData(transactionData);
      } catch (error) {
        console.error(`Unable to retrieve Transaction Data for alert ID ${row.alertId}`, error);
      }
    };

    fetchTransactionData();
  }, [row?.alertId]);

  const creditorFsp = getNestedValue(transactionData, ['InstdAgt', 'FinInstnId', 'ClrSysMmbId', 'MmbId']);
  const debtorFsp = getNestedValue(transactionData, ['InstgAgt', 'FinInstnId', 'ClrSysMmbId', 'MmbId']);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Case Information */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">Case Information</div>
          <SectionCard>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase">Case ID</div>
                <div className="font-medium text-gray-900">{row.id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Case Type</div>
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${row.typeColor}`}>
                  {row.type || 'N/A'}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Status</div>
                <span className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${row.statusColor}`}>
                  {getCaseStatusBadge(row.status)}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Priority</div>
                <div className="inline-flex items-center gap-2">
                  <span className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(row.priority)}`}>
                    {row.priority}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Created On</div>
                <div className="font-medium text-gray-900">{row.createdOn}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Picked On</div>
                <div className="font-medium text-gray-900">{row.pickedOn}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Assignee</div>
                <div className="font-medium text-gray-900">{row.assignee || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Total Tasks</div>
                <div className="font-medium text-gray-900">{row.totalTasks}</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Alert Information */}
        {row.alertId && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">Alert Information</div>
            <SectionCard>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Alert ID</div>
                  <div className="font-medium text-gray-900">{row.alertId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Confidence Score</div>
                  <div className={`inline-flex px-2 py-1 text-sm font-bold rounded-full ${getScoreColor(row.confidencePercent || 0)}`}>
                    {row.confidencePercent || 0}%
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 uppercase">Message</div>
                  <div className="font-medium text-gray-900 mt-1">{row.alertMessage || 'N/A'}</div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Transactions */}
      {transactionalData && transactionalData.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">Transactions</div>

          {transactionalData.map((tx) => {
            const isOpen = openTransactions[tx.transactionId] || false;
            const txTp = getNestedValue(tx.transactionData as Record<string, unknown>, ['TxTp']);

            return (
              <section
                key={tx.transactionId}
                className="rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                {/* HEADER */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenTransactions((prev) => ({
                      ...prev,
                      [tx.transactionId]: !prev[tx.transactionId],
                    }))
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {txTp}
                    </h4>
                  </div>
                  {isOpen ? (
                    <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {/* BODY */}
                {isOpen && (
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    {tx.transactionData ? (
                      <pre
                        className="whitespace-pre-wrap break-words max-h-64 overflow-auto text-sm"
                        dangerouslySetInnerHTML={{
                          __html: syntaxHighlightJson(tx.transactionData),
                        }}
                      />
                    ) : (
                      <div className="text-sm text-gray-600">
                        No transaction data
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Actions Panel */}
      {showActions && (
        <div className="col-span-full">
          <CaseActionsPanel
            caseData={row}
            canManageSupervisorActions={canManageSupervisorActions}
            onComplete={onComplete}
            onCloseCase={onCloseCase}
            onReopenCase={onReopenCase}
            onAbandonCase={onAbandonCase}
            onSuspendCase={onSuspendCase}
            onResumeCase={onResumeCase}
            onApproveCase={onApproveCase}
            onApproveCaseReopen={onApproveCaseReopen}
            onRejectCaseReopen={onRejectCaseReopen}
            onApproveCaseCreation={onApproveCaseCreation}
            onRejectCaseCreation={onRejectCaseCreation}
          />
        </div>
      )}

    </div>
  );
};
export default CaseDetailsTab;
