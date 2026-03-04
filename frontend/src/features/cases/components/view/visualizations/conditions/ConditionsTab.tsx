import React, { useState, useEffect } from 'react';
import type { ConditionsData } from './types';
import { SubjectSelectionPanel } from './components/SubjectSelectionPanel';
import { AccountSelector } from './components/AccountSelector';
import { SelectedSubjectDetailsCard } from './components/SelectedSubjectDetailsCard';
import { ConditionsHeader } from './components/ConditionsHeader';
import { ConditionsCardsList } from './components/ConditionsCardsList';
import type { DisplayCondition } from './types';

interface ConditionsTabProps {
  caseId?: string;
  transactionId?: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [data, setData] = useState<ConditionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingAsOf] = useState<Date>(() => new Date());
  const [showInactive, setShowInactive] = useState(false);
  const [subjectSide, setSubjectSide] = useState<'DEBTOR' | 'CREDITOR'>('DEBTOR');
  const [subjectLevel, setSubjectLevel] = useState<'ENTITY' | 'ACCOUNT'>('ENTITY');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ACC-1234-7777');
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

  const mockAccountsBySide: Record<
    'DEBTOR' | 'CREDITOR',
    Array<{ id: string; name: string; numberMasked: string; type: string; activeCount: number }>
  > = {
    DEBTOR: [
      {
        id: 'ACC-5678-9812',
        name: 'Checking',
        numberMasked: '****5678-9812',
        type: 'TXN ACCOUNT',
        activeCount: 1,
      },
      {
        id: 'ACC-9999-1234',
        name: 'Savings',
        numberMasked: '****9999-1234',
        type: 'ACCOUNT',
        activeCount: 1,
      },
      {
        id: 'ACC-1234-7777',
        name: 'Business',
        numberMasked: '****7777-5555',
        type: 'ACCOUNT',
        activeCount: 2,
      },
    ],
    CREDITOR: [
      {
        id: 'ACC-0000-2222',
        name: 'Primary',
        numberMasked: '****0000-2222',
        type: 'ACCOUNT',
        activeCount: 1,
      },
      {
        id: 'ACC-0000-3333',
        name: 'Secondary',
        numberMasked: '****0000-3333',
        type: 'ACCOUNT',
        activeCount: 0,
      },
    ],
  };

  const mockDataBySide: Record<'DEBTOR' | 'CREDITOR', ConditionsData> = {
    DEBTOR: {
      metrics: { active: 1, blocked: 1, overridden: 0, future: 1 },
      activeConditions: [
        {
          id: 'COND-PEP-SANCTIONS',
          title: 'PEP Sanctions List',
          type: 'BLOCK',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: null,
          status: 'ACTIVE',
          severity: 'high',
          createdBy: 'External Watchlist Provider',
          notes: 'Confirmed match on name and DOB',
          action: 'BLOCK',
        },
      ],
      expiredConditions: [
        {
          id: 'COND-HIGH-RISK-JURIS',
          title: 'High Risk Jurisdiction',
          type: 'EXPIRED',
          startDate: '2023-06-15T00:00:00.000Z',
          endDate: '2023-12-31T23:59:00.000Z',
          status: 'EXPIRED',
          severity: 'low',
          createdBy: 'Internal Risk Policy',
          notes: 'Entity operates in high-risk region',
        },
      ],
      futureConditions: [
        {
          id: 'COND-TEMP-FREEZE',
          title: 'Temporary Freeze',
          type: 'FUTURE',
          startDate: '2024-01-16T00:00:00.000Z',
          endDate: null,
          status: 'FUTURE',
          severity: 'medium',
          createdBy: 'Fraud Operations',
          notes: 'Pending investigation',
        },
      ],
      evaluatedTransactions: [],
    },
    CREDITOR: {
      metrics: { active: 1, blocked: 0, overridden: 0, future: 0 },
      activeConditions: [
        {
          id: 'COND-NEW-ENTITY-PROB',
          title: 'New Entity Probation',
          type: 'OVERRIDE',
          startDate: '2024-01-10T00:00:00.000Z',
          endDate: '2024-02-10T00:00:00.000Z',
          status: 'ACTIVE',
          severity: 'medium',
          createdBy: 'Onboarding System',
          notes: 'Entity onboarded < 30 days ago',
          action: 'OVERRIDE',
        },
      ],
      expiredConditions: [],
      futureConditions: [],
      evaluatedTransactions: [],
    },
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const sideAccounts = mockAccountsBySide[subjectSide];
      const defaultAccountId = sideAccounts[0]?.id;
      const resolvedAccountId = selectedAccountId || defaultAccountId || '';
      if (!selectedAccountId && defaultAccountId) {
        setSelectedAccountId(defaultAccountId);
      }

      const selectedAccount = sideAccounts.find((a) => a.id === resolvedAccountId);

      const mockedSubjectDetails =
        subjectSide === 'DEBTOR'
          ? {
              entityName: 'John Smith',
              entityId: 'ENT-US-9823',
              accountId: resolvedAccountId,
              accountType: selectedAccount?.name || 'Business',
              accountNumber: selectedAccount?.numberMasked || '****7777-5555',
            }
          : {
              entityName: 'Global Trading Corp',
              entityId: 'ENT-UK-5541',
              accountId: resolvedAccountId,
              accountType: selectedAccount?.name || 'Primary',
              accountNumber: selectedAccount?.numberMasked || '****0000-2222',
            };

      setSubjectDetails(mockedSubjectDetails);

      const mock = mockDataBySide[subjectSide];
      setData(mock);
      setLoading(false);
    };

    fetchData();
  }, [caseId, transactionId, timeRange, subjectSide, selectedAccountId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">Loading conditions...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-gray-500">No data available</div>
    );
  }

  const activeBlocksCount = (data.activeConditions || []).filter((c) => c.action === 'BLOCK').length;

  const displayedConditions = showInactive
    ? [...(data.activeConditions || []), ...(data.expiredConditions || []), ...(data.futureConditions || [])]
    : [...(data.activeConditions || [])];

  const activeCount = (data.activeConditions || []).length;

  const formatDateRange = (start: string, end?: string | null) => {
    const startLabel = start ? new Date(start).toLocaleString() : '-';
    const endLabel = end ? new Date(end).toLocaleString() : 'Indefinite';
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
              {transactionId || '-'}
            </span>
          </div>
        </div>

        <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3">
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
          <div className="text-[10px] font-semibold leading-none text-blue-700">VIEWING CONDITIONS AS OF</div>
          <div className="text-xs font-semibold leading-none text-blue-900">{viewingAsOf.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex gap-6 p-4">
        <div className="w-[360px] shrink-0 space-y-4">
          <SubjectSelectionPanel
            subjectSide={subjectSide}
            onChangeSide={setSubjectSide}
            subjectLevel={subjectLevel}
            onChangeLevel={setSubjectLevel}
            accountsAvailable={mockAccountsBySide[subjectSide].length}
          />

          {subjectLevel === 'ACCOUNT' && (
            <AccountSelector
              accounts={mockAccountsBySide[subjectSide]}
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
