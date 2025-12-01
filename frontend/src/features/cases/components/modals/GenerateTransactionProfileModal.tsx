import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { profileService, type TransactionProfile, type GenerateProfileRequest } from '../../services/profileService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TransactionVolumeChartProps {
  transactions: Array<Record<string, any>>;
}

const TransactionVolumeChart: React.FC<TransactionVolumeChartProps> = ({ transactions }) => {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const chartData = React.useMemo(() => {
    const grouped = transactions.reduce((acc: Record<string, number>, tx: any) => {
      const date = tx.date || tx.Date || '';
      const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.Amount || tx.amount || 0);

      if (date) {
        acc[date] = (acc[date] || 0) + amount;
      }
      return acc;
    }, {});

    const dailyData = Object.entries(grouped)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const total = dailyData.reduce((sum, d) => sum + d.amount, 0);
    const peerAverage = dailyData.length > 0 ? total / dailyData.length : 0;

    return dailyData.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Daily Amount': d.amount,
      'Peer Average': peerAverage,
      isAnomaly: d.amount > peerAverage * 2,
    }));
  }, [transactions]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isAnomaly) {
      return (
        <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1} />
      );
    }
    return null;
  };

  if (!isReady) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading chart...</div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          interval="preserveStartEnd"
          tickFormatter={(value, index) => {
            return index % 10 === 0 ? value : '';
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={(value) => `${value.toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px'
          }}
          formatter={(value: any) => `$${value.toLocaleString()}`}
          labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="Daily Amount"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={<CustomDot />}
        />
        <Line
          type="monotone"
          dataKey="Peer Average"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

interface GenerateTransactionProfileModalProps {
  open: boolean;
  onClose: () => void;
  caseId?: string;
  tenantId?: string;
  onSaveProfile?: (profileData: {
    generatedAt: string;
    totalVolume: string;
    anomalies: number;
    riskLevel: string;
    notes?: string;
  }) => void;
  initialProfile?: {
    generatedAt: string;
    totalVolume: string;
    anomalies: number;
    riskLevel: string;
    notes?: string;
  } | null;
}


const GenerateTransactionProfileModal: React.FC<GenerateTransactionProfileModalProps> = ({ open, onClose,  tenantId: initialTenantId, onSaveProfile, initialProfile }) => {
  const [saving, setSaving] = React.useState(false);
  const [loading] = React.useState(false);
  const [notes] = React.useState(initialProfile?.notes || '');
  const [profileData, setProfileData] = React.useState<TransactionProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<'initial' | 'generated'>('initial');
  const [showFilters, setShowFilters] = React.useState(false);
  const tenantId = initialTenantId || 'T001';

  const [filters, setFilters] = React.useState({
    transactionTypes: {
      wireTransfer: true,
      transfer: true,
      withdrawal: true,
      payment: true,
      deposit: true,
    },
    accounts: {
      'A1001': true,
      'A1002': true,
      'A1003': true,
      'A1004': true,
    },
    entityRoles: {
      debtor: true,
      creditor: true,
    },
  });

  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  const allTransactions = profileData?.transactionTable || [];

  const filteredTransactions = allTransactions.filter((tx: any) => {
    const txType = (tx.Type || tx.type || '').toLowerCase();
    const txRole = (tx.Role || tx.role || '').toLowerCase();
    const txAccount = tx.Account || tx.account || '';

    const typeMatch =
      (filters.transactionTypes.wireTransfer && txType.includes('wire')) ||
      (filters.transactionTypes.transfer && txType.includes('transfer') && !txType.includes('wire')) ||
      (filters.transactionTypes.payment && txType.includes('payment')) ||
      (filters.transactionTypes.deposit && txType.includes('deposit')) ||
      (filters.transactionTypes.withdrawal && txType.includes('withdrawal'));

    const accountMatch = Object.entries(filters.accounts).some(([account, enabled]) =>
      enabled && txAccount === account
    );

    const roleMatch =
      (filters.entityRoles.debtor && txRole.includes('debtor')) ||
      (filters.entityRoles.creditor && txRole.includes('creditor'));

    return typeMatch && accountMatch && roleMatch;
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayTransactions = filteredTransactions.slice(startIndex, endIndex);

  const displayMetrics = profileData?.metrics || {};

  React.useEffect(() => {
    if (open && !initialProfile) {
      setStep('initial');
      setProfileData(null);
      setError(null);
      setCurrentPage(1);
    }
  }, [open, initialProfile]);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredTransactions.length, currentPage, totalPages]);

  if (!open) return null;

  const handleGenerateProfile = async () => {
    setSaving(true);
    setError(null);

    try {
      let filters: any = {};

      if (filters && Object.keys(filters).length === 0) {
        filters = undefined;
      }

      const request: GenerateProfileRequest = {
        tenantId: tenantId,
        ...(filters ? { filters } : {}),
        notes,
      };

      const response = await profileService.generateProfile(request);
      setProfileData(response);
      setStep('generated');
    } catch (err: any) {
      setError(err.message || 'Failed to generate profile');
    } finally {
      setSaving(false);
    }
  };

  const determineRiskLevel = (anomalies: Array<{ risk: string }>): string => {
    if (!anomalies || anomalies.length === 0) return 'Low';
    const highRiskCount = anomalies.filter(a => a.risk === 'High').length;
    if (highRiskCount > 0) return 'High';
    const mediumRiskCount = anomalies.filter(a => a.risk === 'Medium').length;
    if (mediumRiskCount > 0) return 'Medium';
    return 'Low';
  };

  const handleSaveProfile = () => {
    if (profileData) {
      if (onSaveProfile) {
        onSaveProfile({
          generatedAt: new Date().toLocaleString(),
          totalVolume: '$' + (profileData.metrics?.totalValue?.toLocaleString() || '0'),
          anomalies: profileData.detectedAnomalies?.length || 0,
          riskLevel: determineRiskLevel(profileData.detectedAnomalies || []),
          notes,
        });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-6xl rounded-lg bg-white shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Generate Transaction Profile
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              90-Day Behavioral Analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-600">Loading profile data...</p>
              </div>
            </div>
          ) : step === 'initial' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15l4-4 4 4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Generate Transaction Profile</h3>
              <p className="text-base text-gray-600 mb-6 max-w-xl text-center">
                Analyze 90 days of transaction data, calculate peer deviations, and identify anomalies or patterns suggesting layering or structuring activities.
              </p>
              <div className="w-full max-w-xs mx-auto text-left space-y-3 mb-8">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-sm text-gray-900">Transaction Trends</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-gray-900">Anomaly Detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm text-gray-900">Peer Comparison</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-900">Investigator Notes</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {/* Total Volume Card */}
                <div className="rounded-lg border border-gray-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Total Volume</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        ${(displayMetrics.totalVolume || displayMetrics.totalValue || 0).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-green-600">
                        {displayMetrics.volumeChangePercent || '+8.5%'} vs prior
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>

                {/* Avg Daily Amount Card */}
                <div className="rounded-lg border border-gray-200 bg-green-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Avg Daily Amount</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        ${(displayMetrics.avgDailyAmount || displayMetrics.avgTicketSize || 0).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-green-600">
                        {displayMetrics.avgDailyChangePercent || '+18.9%'} vs prior avg
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </div>
                </div>

                {/* Total Transactions Card */}
                <div className="rounded-lg border border-gray-200 bg-purple-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Total Transactions</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        {displayMetrics.totalTransactions || displayMetrics.transactionCount || 0}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {displayMetrics.avgTransactionRange || 'Avg 12-14'}
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>

                {/* High Value Txns Card */}
                <div className="rounded-lg border border-gray-200 bg-orange-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Anomalies Detected</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900">
                        {profileData?.detectedAnomalies?.length || 0}
                      </p>
                      <p className="mt-1 text-xs text-orange-600">
                        {profileData?.detectedAnomalies?.filter((a: any) => a.risk === 'High').length || 0} High Risk
                      </p>
                    </div>
                    <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Transaction Volume Trend Chart */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Transaction Volume Trend (90 Days)
                </h3>
                <div style={{ width: '100%', height: 256 }}>
                  {profileData?.transactionTable && profileData.transactionTable.length > 0 ? (
                    <TransactionVolumeChart transactions={profileData.transactionTable} />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded border border-gray-200">
                      <p className="text-sm text-gray-500">No data available</p>
                    </div>
                  )}
                </div>
              </div>

            {/* Transaction List */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  Transaction List ({displayTransactions.length} of {allTransactions.length} transactions)
                </h3>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>

              {/* Filters Section */}
              {showFilters && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                  <div className="grid grid-cols-3 gap-6">
                    {/* Transaction Type Filters */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Transaction Type</h4>
                      <div className="space-y-2">
                        {Object.entries(filters.transactionTypes).map(([key, value]) => (
                          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setFilters({
                                ...filters,
                                transactionTypes: {
                                  ...filters.transactionTypes,
                                  [key]: e.target.checked
                                }
                              })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="capitalize">{key === 'wireTransfer' ? 'Wire Transfer' : key}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Account Filters */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Account</h4>
                      <div className="space-y-2">
                        {Object.entries(filters.accounts).map(([key, value]) => (
                          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setFilters({
                                ...filters,
                                accounts: {
                                  ...filters.accounts,
                                  [key]: e.target.checked
                                }
                              })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{key}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Entity Role Filters */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Entity Role</h4>
                      <div className="space-y-2">
                        {Object.entries(filters.entityRoles).map(([key, value]) => (
                          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setFilters({
                                ...filters,
                                entityRoles: {
                                  ...filters.entityRoles,
                                  [key]: e.target.checked
                                }
                              })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="capitalize">{key} ({key === 'debtor' ? 'Outgoing' : 'Incoming'})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      onClick={() => setShowFilters(false)}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Transaction ID
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Type
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Account
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Counterparty
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Role
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {displayTransactions.map((transaction: any, index: number) => {
                      const date = transaction.Date || transaction.date;
                      const transactionId = transaction['Transaction ID'] || transaction.transactionId;
                      const type = transaction.Type || transaction.type;
                      const account = transaction.Account || transaction.account;
                      const counterparty = transaction.Counterparty || transaction.counterparty;
                      const role = transaction.Role || transaction.role;
                      const amount = transaction.Amount || transaction.amount;

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-900">
                            {date}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-900">
                            {transactionId}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-900">
                            {type}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-900">
                            {account}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-900">
                            {counterparty}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs">
                            <div className="flex items-center gap-1">
                              <span className={role === 'Creditor' ? 'text-green-600' : 'text-gray-600'}>
                                {role === 'Creditor' ? '↑' : '↓'}
                              </span>
                              <span className="text-gray-900">{role}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-right font-medium text-gray-900">
                            {typeof amount === 'number'
                              ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : amount
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredTransactions.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIndex, filteredTransactions.length)}</span> of{' '}
                    <span className="font-medium">{filteredTransactions.length}</span> transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        const showPage =
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1);

                        const showEllipsis =
                          (page === 2 && currentPage > 3) ||
                          (page === totalPages - 1 && currentPage < totalPages - 2);

                        if (showEllipsis) {
                          return <span key={page} className="px-2 text-gray-500">...</span>;
                        }

                        if (!showPage) {
                          return null;
                        }

                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[2rem] px-3 py-1.5 text-sm font-medium rounded-md ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-800 mb-2">Key Observations</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                      <li>High frequency of large transactions suggests potential structuring activity</li>
                      <li>Review transaction patterns and counterparties for correlation with suspicious activities</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Investigator Analysis & Notes</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Add your observations, analysis, and conclusions about the transaction patterns. This narrative will be included in the profile and visible to supervisors.
                </p>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your analysis of the transaction patterns, any correlations with other evidence, and recommendations for further investigation..."
                />
              </div>
            </div>
          </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          {step === 'initial' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateProfile}
                className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                disabled={saving || !tenantId}
              >
                {saving ? 'Generating...' : 'Generate Profile'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'Saving...' : 'Save Profile to Case'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateTransactionProfileModal;
