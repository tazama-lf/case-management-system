import React from 'react';
import type { DisplayCondition } from '../types';

interface ConditionsCardsListProps {
  conditions: DisplayCondition[];
  formatDateRange: (start: string, end?: string | null) => string;
  leftBorder: (condition: DisplayCondition) => string;
  statusBadge: (status: DisplayCondition['status']) => string;
}

export const ConditionsCardsList: React.FC<ConditionsCardsListProps> = ({
  conditions,
  formatDateRange,
  leftBorder,
  statusBadge,
}) => {
  const iconStyle = (condition: DisplayCondition) => {
    if (condition.status === 'EXPIRED') return 'bg-gray-100 text-gray-500 ring-1 ring-gray-200';
    if (condition.status === 'FUTURE') return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200';
    if (condition.action === 'BLOCK') return 'bg-red-50 text-red-600 ring-1 ring-red-200';
    return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  };

  const ActionIcon: React.FC<{ condition: DisplayCondition }> = ({ condition }) => {
    return (
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${iconStyle(
          condition,
        )}`}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M10 18c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7.2 7.2 12.8 12.8M12.8 7.2 7.2 12.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  };

  if (conditions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">No conditions.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conditions.map((condition) => (
        <div
          key={`${condition.status}-${condition.id}`}
          className={`rounded-lg border border-gray-200 bg-white border-l-4 ${leftBorder(condition)}`}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <ActionIcon condition={condition} />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-900 truncate">{condition.title}</div>
                    {condition.status !== 'ACTIVE' && (
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${statusBadge(
                          condition.status,
                        )}`}
                      >
                        {condition.status}
                      </span>
                    )}
                  </div>

                  {condition.notes && (
                    <div className="mt-0.5 text-xs text-gray-500">{condition.notes}</div>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold text-gray-500">SOURCE</div>
                <div className="text-xs font-medium text-gray-700">{condition.createdBy || '—'}</div>
              </div>
            </div>

            <div className="mt-3 border-t border-gray-100" />

            <div className="mt-3 flex items-center justify-between gap-4 text-xs">
              <div className="flex min-w-0 items-center gap-2 text-gray-600">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-400" aria-hidden="true">
                  <path
                    d="M6.5 2.5v3M13.5 2.5v3M3 7h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4.5 4.5h11A2.5 2.5 0 0 1 18 7v9.5A2.5 2.5 0 0 1 15.5 19h-11A2.5 2.5 0 0 1 2 16.5V7A2.5 2.5 0 0 1 4.5 4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>

                <span className="font-semibold text-gray-500">Effective:</span>
                <div className="flex min-w-0 items-center gap-2">
                  {(() => {
                    const range = formatDateRange(condition.startDate, condition.endDate);
                    const parts = range.split('→');
                    const start = (parts[0] || '').trim();
                    const end = (parts[1] || '').trim();

                    return (
                      <>
                        <span className="truncate">{start}</span>
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-4 w-4 shrink-0 text-gray-400"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 10h12"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="m12 6 4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="truncate">{end}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {condition.action && (
                <div className="shrink-0">
                  <span className="font-semibold text-gray-500">Action:</span>{' '}
                  <span
                    className={`${
                      condition.action === 'BLOCK' ? 'text-red-700' : 'text-blue-700'
                    } font-semibold`}
                  >
                    {condition.action}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
