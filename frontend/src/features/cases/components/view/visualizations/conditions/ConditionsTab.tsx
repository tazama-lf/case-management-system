import React, { useState, useEffect } from 'react';
import type { ConditionsData } from './types';
import { SubjectSelectionPanel } from './components/SubjectSelectionPanel';
import { AccountSelector } from './components/AccountSelector';
import { SelectedSubjectDetailsCard } from './components/SelectedSubjectDetailsCard';
import { ConditionsHeader } from './components/ConditionsHeader';
import { ConditionsCardsList } from './components/ConditionsCardsList';
import type { DisplayCondition } from './types';
import type { ConditionsTransactionContextResponse } from './types';
import ConditionsService from './services/service.ts';

interface ConditionsTabProps {
  caseId?: string;
  transactionId?: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  transactionId,
}) => {
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [data, setData] = useState<ConditionsData | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txContext, setTxContext] = useState<ConditionsTransactionContextResponse | null>(null);
  const [viewingAsOf, setViewingAsOf] = useState<Date>(() => new Date());
  const [asOfOpen, setAsOfOpen] = useState(false);
  const [asOfDraftDate, setAsOfDraftDate] = useState<string>('');
  const [asOfDraftHour, setAsOfDraftHour] = useState<string>('12');
  const [asOfDraftMinute, setAsOfDraftMinute] = useState<string>('00');
  const [asOfDraftAmPm, setAsOfDraftAmPm] = useState<'am' | 'pm'>('am');
  const [asOfViewMonth, setAsOfViewMonth] = useState<Date>(() => new Date());
  const [showInactive, setShowInactive] = useState(false);
  const [subjectSide, setSubjectSide] = useState<'DEBTOR' | 'CREDITOR'>('DEBTOR');
  const [subjectLevel, setSubjectLevel] = useState<'ENTITY' | 'ACCOUNT'>('ENTITY');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [subjectDetails, setSubjectDetails] = useState<{
    entityName?: string;
    entityId?: string;
    accountId?: string;
    accountType?: string;
    accountNumber?: string;
  } | null>(null);

  const timeRangeOptions = [
    'Last 30 Days',
    'Last 60 Days',
    'Last 90 Days',
    'Last 6 Months',
    'Last Year',
    'All Time',
  ];

  const toDateInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const parseDateInputValue = (value: string): Date | null => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map((v) => Number(v));
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const addMonths = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);

  const setDraftFromDate = (d: Date) => {
    setAsOfDraftDate(toDateInputValue(d));
    setAsOfViewMonth(startOfMonth(d));

    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm: 'am' | 'pm' = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;

    setAsOfDraftHour(String(hour12).padStart(2, '0'));
    setAsOfDraftMinute(String(minutes).padStart(2, '0'));
    setAsOfDraftAmPm(ampm);
  };

  const parseDraftToDate = (): Date | null => {
    if (!asOfDraftDate) return null;

    const [year, month, day] = asOfDraftDate.split('-').map((v) => Number(v));
    const hourRaw = Number(asOfDraftHour);
    const minute = Number(asOfDraftMinute);
    if (!year || !month || !day || Number.isNaN(hourRaw) || Number.isNaN(minute)) return null;

    const hour12 = Math.min(Math.max(hourRaw, 1), 12);
    const hour24 = asOfDraftAmPm === 'pm' ? (hour12 % 12) + 12 : hour12 % 12;

    const next = new Date(year, month - 1, day, hour24, minute, 0, 0);
    return Number.isNaN(next.getTime()) ? null : next;
  };

  const monthLabel = (d: Date) =>
    d.toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });

  const renderCalendarDays = () => {
    const view = startOfMonth(asOfViewMonth);
    const firstDayOfWeek = view.getDay();
    const gridStart = new Date(view);
    gridStart.setDate(view.getDate() - firstDayOfWeek);

    const selected = parseDateInputValue(asOfDraftDate);

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);

      const inMonth = d.getMonth() === view.getMonth();
      const isSelected =
        !!selected &&
        d.getFullYear() === selected.getFullYear() &&
        d.getMonth() === selected.getMonth() &&
        d.getDate() === selected.getDate();

      const isToday = (() => {
        const t = new Date();
        return (
          d.getFullYear() === t.getFullYear() &&
          d.getMonth() === t.getMonth() &&
          d.getDate() === t.getDate()
        );
      })();

      const base = 'h-8 w-8 rounded-lg text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
      const cls = isSelected
        ? `${base} bg-blue-600 text-white`
        : inMonth
          ? `${base} text-gray-800 hover:bg-gray-100`
          : `${base} text-gray-300 hover:bg-gray-50`;

      const ring = isToday && !isSelected ? 'ring-1 ring-blue-300' : '';

      return (
        <button
          key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
          type="button"
          onClick={() => {
            setAsOfDraftDate(toDateInputValue(d));
            setAsOfViewMonth(startOfMonth(d));
          }}
          className={`${cls} ${ring}`}
        >
          {d.getDate()}
        </button>
      );
    });
  };

  const getFromDate = (range: string): string | undefined => {
    const now = new Date();
    let daysAgo = 0;

    switch (range) {
      case 'Last 30 Days':
        daysAgo = 30;
        break;
      case 'Last 60 Days':
        daysAgo = 60;
        break;
      case 'Last 90 Days':
        daysAgo = 90;
        break;
      case 'Last 6 Months':
        daysAgo = 180;
        break;
      case 'Last Year':
        daysAgo = 365;
        break;
      case 'All Time':
        return undefined;
      default:
        return undefined;
    }

    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - daysAgo);
    return fromDate.toISOString().split('T')[0];
  };

  useEffect(() => {
    const fetchContext = async () => {
      const fallbackTransactionId = 257758;
      const parsedTxId = transactionId ? parseInt(transactionId, 10) : NaN;
      const txId = Number.isFinite(parsedTxId) ? parsedTxId : fallbackTransactionId;

      setLoadingContext(true);
      setError(null);
      try {
        const context = await ConditionsService.getContextByTransaction(txId);
        setTxContext(context);

        const asOf = context.metadata?.asOfDate ? new Date(context.metadata.asOfDate) : new Date();
        setViewingAsOf(asOf);
        setDraftFromDate(asOf);

        const party = subjectSide === 'DEBTOR' ? context.debtor : context.creditor;
        const defaultAccountId = party.primaryAccountId || party.accounts?.[0]?.accountId || '';

        setSelectedAccountId((prev) => prev || defaultAccountId);
      } catch (err) {
        // Try fallback transactionId if the request was for a different id
        if (txId !== fallbackTransactionId) {
          try {
            const fallbackContext = await ConditionsService.getContextByTransaction(
              fallbackTransactionId,
            );
            setTxContext(fallbackContext);
            const asOf = fallbackContext.metadata?.asOfDate
              ? new Date(fallbackContext.metadata.asOfDate)
              : new Date();
            setViewingAsOf(asOf);
            setDraftFromDate(asOf);
            const party = subjectSide === 'DEBTOR' ? fallbackContext.debtor : fallbackContext.creditor;
            const defaultAccountId =
              party.primaryAccountId || party.accounts?.[0]?.accountId || '';
            setSelectedAccountId((prev) => prev || defaultAccountId);
            setError(null);
          } catch (fallbackErr) {
            setError(
              fallbackErr instanceof Error
                ? fallbackErr.message
                : 'Failed to fetch transaction context',
            );
          }
        } else {
          setError(err instanceof Error ? err.message : 'Failed to fetch transaction context');
        }
      } finally {
        setLoadingContext(false);
      }
    };

    fetchContext();
  }, [transactionId]);

  useEffect(() => {
    if (!txContext) {
      return;
    }
    const party = subjectSide === 'DEBTOR' ? txContext.debtor : txContext.creditor;
    const nextDefault = party.primaryAccountId || party.accounts?.[0]?.accountId || '';
    setSelectedAccountId(nextDefault);
  }, [subjectSide, txContext]);

  useEffect(() => {
    const fetchConditions = async () => {
      if (!txContext) {
        return;
      }

      const party = subjectSide === 'DEBTOR' ? txContext.debtor : txContext.creditor;
      const resolvedAccountId =
        subjectLevel === 'ACCOUNT'
          ? selectedAccountId || party.primaryAccountId || party.accounts?.[0]?.accountId || ''
          : party.primaryAccountId || party.accounts?.[0]?.accountId || '';

      if (!resolvedAccountId) {
        setData({
          metrics: { active: 0, blocked: 0, overridden: 0, future: 0 },
          activeConditions: [],
          expiredConditions: [],
          futureConditions: [],
          evaluatedTransactions: [],
        });
        return;
      }

      if (subjectLevel === 'ACCOUNT') {
        setSelectedAccountId(resolvedAccountId);
      }

      const selectedAccount = (party.accounts || []).find((a) => a.accountId === resolvedAccountId);
      setSubjectDetails({
        entityName: party.entityName,
        entityId: party.entityId,
        accountId: resolvedAccountId,
        accountType: selectedAccount?.accountType,
        accountNumber: selectedAccount?.accountNumber,
      });

      setLoadingConditions(true);
      setError(null);
      try {
        const fromDate = getFromDate(timeRange);
        const conditions = await ConditionsService.getConditionsData(resolvedAccountId, {
          asOfDate: viewingAsOf.toISOString(),
          showInactive,
          fromDate,
        });
        setData(conditions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch conditions');
      } finally {
        setLoadingConditions(false);
      }
    };

    fetchConditions();
  }, [txContext, subjectSide, subjectLevel, selectedAccountId, timeRange, showInactive, viewingAsOf]);

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (!txContext) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-gray-500">
        {loadingContext ? (
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
            aria-label="Loading"
          />
        ) : null}
        <div className="text-sm font-medium">
          {loadingContext ? 'Loading conditions...' : 'No data available'}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-gray-500">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
          aria-label="Loading"
        />
        <div className="text-sm font-medium">Loading conditions...</div>
      </div>
    );
  }

  const party = subjectSide === 'DEBTOR' ? txContext.debtor : txContext.creditor;
  const accountsForSide = (party.accounts || []).map((a, idx) => ({
    id: a.accountId,
    name: a.accountType || (a.isTransactionAccount ? 'Transaction Account' : `Account ${idx + 1}`),
    numberMasked: a.accountNumber,
    type: a.isTransactionAccount ? 'TXN ACCOUNT' : 'ACCOUNT',
    activeCount: a.activeConditionsCount,
  }));

  const activeBlocksCount = (data.activeConditions || []).filter((c) => c.action === 'BLOCK').length;

  const displayedConditions = showInactive
    ? [...(data.activeConditions || []), ...(data.expiredConditions || []), ...(data.futureConditions || [])]
    : [...(data.activeConditions || [])];

  const activeCount = (data.activeConditions || []).length;

  const normalizeIsoForJsDate = (value: string) => {
    // JS Date parsing is unreliable for ISO timestamps with >3 fractional second digits.
    // Example backend: 2025-12-31T07:41:53.855000
    return value.replace(/\.(\d{3})\d+/, '.$1');
  };

  const formatDateRange = (start: string, end?: string | null) => {
    const startLabel = start ? new Date(normalizeIsoForJsDate(start)).toLocaleString() : '-';
    const endLabel = end ? new Date(normalizeIsoForJsDate(end)).toLocaleString() : 'Indefinite';
    return `${startLabel} → ${endLabel}`;
  };

  const statusBadge = (status: DisplayCondition['status']) => {
    if (status === 'EXPIRED') return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
    if (status === 'FUTURE') return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200';
    return 'bg-green-50 text-green-700 ring-1 ring-green-200';
  };

  const leftBorder = (condition: DisplayCondition) => {
    if (condition.status === 'EXPIRED') return 'border-l-gray-300';
    if (condition.status === 'FUTURE') return 'border-l-purple-400';
    if (condition.action === 'BLOCK') return 'border-l-red-500';
    return 'border-l-blue-500';
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-900">Condition Timeline</div>
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            Transaction:{' '}
            <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              {txContext.transaction.displayId || transactionId || '-'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraftFromDate(viewingAsOf);
                setAsOfViewMonth(startOfMonth(viewingAsOf));
                setAsOfOpen((v) => !v);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-blue-700" aria-hidden="true">
                <path
                  d="M10 18c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 6v4l2.5 1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-left">
                <div className="text-[10px] font-semibold leading-none text-blue-700">VIEWING CONDITIONS AS OF</div>
                <div className="mt-0.5 text-xs font-semibold leading-none text-blue-900">
                  {viewingAsOf.toLocaleString()}
                </div>
              </div>
              <svg viewBox="0 0 20 20" fill="none" className="ml-2 h-4 w-4 text-blue-700" aria-hidden="true">
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
            </button>

            {asOfOpen && (
              <div className="absolute right-0 z-20 mt-3 w-[520px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white px-3 py-2.5">
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-gray-500">Viewing conditions as of</div>
                    <div className="mt-0.5 text-sm font-semibold text-gray-900">Select date and time</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAsOfOpen(false)}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-label="Close"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M6 6l8 8M14 6l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    Close
                  </button>
                </div>

                <div className="flex gap-0">
                  <div className="min-w-0 flex-1 border-r border-gray-100 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setAsOfViewMonth((m) => addMonths(m, -1))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                        aria-label="Previous month"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-600" aria-hidden="true">
                          <path
                            d="m12.5 4.5-5 5 5 5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      <div className="text-sm font-semibold text-gray-900">{monthLabel(asOfViewMonth)}</div>

                      <button
                        type="button"
                        onClick={() => setAsOfViewMonth((m) => addMonths(m, 1))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                        aria-label="Next month"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-gray-600" aria-hidden="true">
                          <path
                            d="m7.5 4.5 5 5-5 5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                        <div key={d} className="text-center">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {renderCalendarDays()}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setAsOfDraftDate('');
                        }}
                        className="inline-flex h-9 items-center rounded-lg px-3 text-blue-700 hover:bg-blue-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setDraftFromDate(now);
                        }}
                        className="inline-flex h-9 items-center rounded-lg px-3 text-blue-700 hover:bg-blue-50"
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  <div className="w-[220px] bg-gray-50 p-3">
                    <div className="text-xs font-semibold tracking-wide text-gray-600">Time</div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="h-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <div className="border-b border-gray-100 bg-gray-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Hr
                        </div>
                        <div className="h-[192px] overflow-y-auto">
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setAsOfDraftHour(h)}
                            className={`flex h-8 w-full items-center justify-center text-sm font-semibold ${
                              asOfDraftHour === h
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                        </div>
                      </div>

                      <div className="h-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <div className="border-b border-gray-100 bg-gray-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Min
                        </div>
                        <div className="h-[192px] overflow-y-auto">
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setAsOfDraftMinute(m)}
                            className={`flex h-8 w-full items-center justify-center text-sm font-semibold ${
                              asOfDraftMinute === m
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                        </div>
                      </div>

                      <div className="h-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <div className="border-b border-gray-100 bg-gray-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          AM/PM
                        </div>
                        <div className="h-[192px] overflow-y-auto">
                        {(['pm', 'am'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAsOfDraftAmPm(v)}
                            className={`flex h-8 w-full items-center justify-center text-sm font-semibold ${
                              asOfDraftAmPm === v
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-800 hover:bg-gray-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAsOfOpen(false)}
                        className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = parseDraftToDate();
                          if (next) {
                            setViewingAsOf(next);
                            setAsOfOpen(false);
                          }
                        }}
                        className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-6 p-4">
        <div className="w-[360px] shrink-0 space-y-4">
          <SubjectSelectionPanel
            subjectSide={subjectSide}
            onChangeSide={setSubjectSide}
            subjectLevel={subjectLevel}
            onChangeLevel={setSubjectLevel}
            accountsAvailable={accountsForSide.length}
          />

          {subjectLevel === 'ACCOUNT' && (
            <AccountSelector
              accounts={accountsForSide}
              selectedAccountId={selectedAccountId}
              onSelectAccount={setSelectedAccountId}
            />
          )}

          <SelectedSubjectDetailsCard
            subjectDetails={subjectDetails}
            subjectLevel={subjectLevel}
            activeBlocksCount={activeBlocksCount}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <ConditionsHeader
            activeCount={activeCount}
            timeRange={timeRange}
            timeRangeOptions={timeRangeOptions}
            onChangeTimeRange={setTimeRange}
            showInactive={showInactive}
            onToggleShowInactive={() => setShowInactive((s) => !s)}
          />

          {loadingConditions && (
            <div className="text-xs font-medium text-gray-500">Loading…</div>
          )}

          <ConditionsCardsList
            conditions={displayedConditions}
            formatDateRange={formatDateRange}
            leftBorder={leftBorder}
            statusBadge={statusBadge}
          />
        </div>
      </div>
    </div>
  );
};

export default ConditionsTab;
