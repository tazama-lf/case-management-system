import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { profileService } from '../../../../services/profileService';

interface ProfileOverviewTabProps {
  alertId?: number;
  transactionId?: string;
}

interface Transaction {
  event_date: string;
  tx_amount: number | string;
  tx_ccy: string;
  tx_type: string;
  [key: string]: unknown;
}

const ProfileOverviewTab: React.FC<ProfileOverviewTabProps> = ({
  alertId,
  transactionId,
}) => {
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'creditor' | 'debtor'>('creditor');
  const [sortConfig, setSortConfig] = useState<{
    key: 'event_date' | 'tx_amount' | 'tx_type' | 'tx_ccy';
    direction: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    if (!alertId) {
      setError('Alert ID is required to generate profile');
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        setProfileData(null);
        setError(null);
        const response = await profileService.generateProfile(alertId);
        if (
          !response ||
          response.transactionCreditorResp?.status !== 'success' ||
          response.transactionDebtorResp?.status !== 'success'
        ) {
          throw new Error('Failed to fetch valid profile data');
        }
        setProfileData(response);
      } catch (err: any) {
        console.error(err);

        setError(
          err?.response?.data?.message ||
          err?.message ||
          'Something went wrong while fetching profile',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [alertId]);

  const selectedData = React.useMemo(() => {
    if (!profileData) return null;

    if (activeTab === 'creditor') {
      return profileData?.transactionCreditorResp?.data?.[0];
    } else {
      return profileData?.transactionDebtorResp?.data?.[0];
    }
  }, [profileData, activeTab]);

  const totalTransactions =
    activeTab === 'creditor'
      ? profileData?.transactionCreditorResp?.row_count
      : profileData?.transactionDebtorResp?.row_count;

  const selectedList =
    activeTab === 'creditor'
      ? profileData?.transactionCreditorResp?.data || []
      : profileData?.transactionDebtorResp?.data || [];

  const sortedTransactions = React.useMemo(() => {
    if (!selectedList) return [];

    const sortable = [...selectedList];

    if (sortConfig !== null) {
      sortable.sort((a: Transaction, b: Transaction) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle date
        if (sortConfig.key === 'event_date') {
          return sortConfig.direction === 'asc'
            ? new Date(aValue).getTime() - new Date(bValue).getTime()
            : new Date(bValue).getTime() - new Date(aValue).getTime();
        }

        // Handle numbers
        if (sortConfig.key === 'tx_amount') {
          return sortConfig.direction === 'asc'
            ? Number(aValue) - Number(bValue)
            : Number(bValue) - Number(aValue);
        }

        // Handle strings
        return sortConfig.direction === 'asc'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });
    }

    return sortable;
  }, [selectedList, sortConfig]);

  const handleSort = (
    key: 'event_date' | 'tx_amount' | 'tx_type' | 'tx_ccy',
  ) => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });
  };

  const totalAmount = selectedList.reduce(
    (sum: number, tx: Transaction) => sum + (Number(tx.tx_amount) || 0),
    0,
  );

  //Volume Trend Data for last 90 days
  const volumeTrendData = React.useMemo(() => {
    const grouped: Record<string, number> = {};

    selectedList.forEach((tx: Transaction) => {
      const date = tx.event_date;

      if (!date) return;

      grouped[date] = (grouped[date] || 0) + (Number(tx.tx_amount) || 0);
    });

    return Object.entries(grouped)
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedList]);

  //Daily Count Graph
  const transactionCountData = React.useMemo(() => {
    const grouped: Record<string, number> = {};

    selectedList.forEach((tx: Transaction) => {
      const date = tx.event_date;

      if (!date) return;

      grouped[date] = (grouped[date] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedList]);

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return '⬍';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!alertId || !transactionId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Unable to display profile data</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">No profile data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Profile Overview
        </h3>

        <div className="flex bg-gray-100 p-1 rounded-md">
          <button
            onClick={() => {
              setActiveTab('creditor');
            }}
            className={`px-4 py-1.5 text-sm rounded-md transition ${activeTab === 'creditor'
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            Creditor
          </button>

          <button
            onClick={() => {
              setActiveTab('debtor');
            }}
            className={`px-4 py-1.5 text-sm rounded-md transition ${activeTab === 'debtor'
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            Debtor
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-900">
        {activeTab === 'creditor' ? 'Creditor Profile' : 'Debtor Profile'}
      </h3>

      <div className="overflow-y-auto flex-1 px-6 py-5">
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Entity Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Entity ID</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedData?.entity_id ?? 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Entity Name</p>
                <p className="text-sm font-semibold text-gray-900">
                  {activeTab === 'creditor'
                    ? selectedData?.creditor_name
                    : selectedData?.debtor_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Entity Role</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedData?.entity_role ?? 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Entity Type</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedData?.entity_type ?? 'N/A'}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-medium text-gray-500">Total Value</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {totalAmount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">Transaction sum</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-medium text-gray-500">
                Total Transactions
              </h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {totalTransactions?.toLocaleString() ?? 'N/A'}
              </p>
              <p className="mt-1 text-xs text-gray-500">Transaction count</p>
            </div>
          </div>

          {/* Transaction Volume Trend Chart */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Transaction Volume Trend (90 Days)
            </h3>
            {volumeTrendData.length === 0 ? (
              <p className="text-gray-500 text-sm">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={volumeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
                  />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#3b82f6"
                    fill="#93c5fd"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Daily Transaction Count Chart */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Daily Transaction Count
            </h3>
            {transactionCountData.length === 0 ? (
              <p className="text-gray-500 text-sm">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={transactionCountData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Transactions
            </h3>

            {sortedTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm">No transactions available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        aria-sort={
                          sortConfig?.key === 'event_date'
                            ? sortConfig.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleSort('event_date');
                          }}
                          className="cursor-pointer inline-flex items-center gap-1 uppercase text-xs font-medium text-gray-500"
                        >
                          Date {getSortIcon('event_date')}
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sortConfig?.key === 'tx_amount'
                            ? sortConfig.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleSort('tx_amount');
                          }}
                          className="cursor-pointer inline-flex items-center gap-1 uppercase text-xs font-medium text-gray-500"
                        >
                          Transaction Amount {getSortIcon('tx_amount')}
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sortConfig?.key === 'tx_ccy'
                            ? sortConfig.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleSort('tx_ccy');
                          }}
                          className="cursor-pointer inline-flex items-center gap-1 uppercase text-xs font-medium text-gray-500"
                        >
                          Transaction Currency {getSortIcon('tx_ccy')}
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sortConfig?.key === 'tx_type'
                            ? sortConfig.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            handleSort('tx_type');
                          }}
                          className="cursor-pointer inline-flex items-center gap-1 uppercase text-xs font-medium text-gray-500"
                        >
                          Transaction Type {getSortIcon('tx_type')}
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedTransactions.map(
                      (tx: Transaction, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(tx.event_date).toLocaleString('sv-SE', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {Number(tx.tx_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {tx.tx_ccy}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {tx.tx_type}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverviewTab;
