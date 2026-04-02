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
import {
  profileService,
} from '../../../../services/profileService';

interface ProfileOverviewTabProps {
  alertId?: number;
  transactionId?: string;
}

//Error Handling is missing, add that. Hard Coded Data should not be shown to the user.
// const volumeTrendData = [
//   { date: 'Week 1', volume: 25000 },
//   { date: 'Week 2', volume: 28000 },
//   { date: 'Week 3', volume: 31000 },
//   { date: 'Week 4', volume: 27000 },
//   { date: 'Week 5', volume: 35000 },
//   { date: 'Week 6', volume: 38000 },
//   { date: 'Week 7', volume: 42000 },
//   { date: 'Week 8', volume: 39000 },
//   { date: 'Week 9', volume: 45000 },
//   { date: 'Week 10', volume: 48000 },
//   { date: 'Week 11', volume: 43000 },
//   { date: 'Week 12', volume: 51380 },
// ];

// const transactionCountData = [
//   { day: 'Mon', count: 52 },
//   { day: 'Tue', count: 48 },
//   { day: 'Wed', count: 61 },
//   { day: 'Thu', count: 55 },
//   { day: 'Fri', count: 73 },
//   { day: 'Sat', count: 39 },
//   { day: 'Sun', count: 28 },
// ];

// const anomaliesData = [
//   {
//     id: 1,
//     date: '2024-11-10',
//     type: 'Large Transfer',
//     amount: '$45,000',
//     description: 'Single transaction exceeds 90-day average by 600%',
//     risk: 'High',
//   },
//   {
//     id: 2,
//     date: '2024-11-08',
//     type: 'Rapid Succession',
//     amount: '$12,300',
//     description: '7 transactions within 15 minutes',
//     risk: 'Medium',
//   },
//   {
//     id: 3,
//     date: '2024-11-05',
//     type: 'Unusual Pattern',
//     amount: '$8,750',
//     description: 'Transaction time outside normal hours (3:42 AM)',
//     risk: 'Medium',
//   },
//   {
//     id: 4,
//     date: '2024-11-03',
//     type: 'Round Amount',
//     amount: '$10,000',
//     description: 'Exact round amount transaction',
//     risk: 'Low',
//   },
//   {
//     id: 5,
//     date: '2024-10-28',
//     type: 'New Recipient',
//     amount: '$15,200',
//     description: 'Large transfer to previously unknown recipient',
//     risk: 'Medium',
//   },
// ];

const ProfileOverviewTab: React.FC<
  ProfileOverviewTabProps
> = ({ alertId, transactionId }) => {
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] =
    useState<any | null>(null);
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
          'Something went wrong while fetching profile'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [alertId]);

  if (!alertId || !transactionId) return null;

  const selectedData = React.useMemo(() => {
    if (!profileData) return null;

    if (activeTab === 'creditor') {
      return profileData?.transactionCreditorResp?.data?.[0];
    } else {
      return profileData?.transactionDebtorResp?.data?.[0];
    }
  }, [profileData, activeTab]);

  const totalTransactions = activeTab === 'creditor' ? profileData?.transactionCreditorResp?.row_count : profileData?.transactionDebtorResp?.row_count;

  const selectedList =
    activeTab === 'creditor'
      ? profileData?.transactionCreditorResp?.data || []
      : profileData?.transactionDebtorResp?.data || [];

  const sortedTransactions = React.useMemo(() => {
    if (!selectedList) return [];

    let sortable = [...selectedList];

    if (sortConfig !== null) {
      sortable.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

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

  const handleSort = (key: 'event_date' | 'tx_amount' | 'tx_type' | 'tx_ccy') => {
    let direction: 'asc' | 'desc' = 'asc';

    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }

    setSortConfig({ key, direction });
  };

  const totalAmount = selectedList.reduce((sum: number, tx: any) => {
    return sum + (Number(tx.tx_amount) || 0);
  }, 0);

  const volumeTrendData = React.useMemo(() => {
    const grouped: Record<string, number> = {};

    selectedList.forEach((tx: any) => {
      const date = tx.event_date;

      if (!date) return;

      grouped[date] =
        (grouped[date] || 0) + (Number(tx.tx_amount) || 0);
    });

    return Object.entries(grouped)
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedList]);

  const transactionCountData = React.useMemo(() => {
    const grouped: Record<string, number> = {};

    selectedList.forEach((tx: any) => {
      const date = tx.event_date;

      if (!date) return;

      grouped[date] = (grouped[date] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedList]);

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return '⬍';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // const handleGenerateProfile = async () => {
  //   if (!alertId) {
  //     setError('Alert ID is required to generate profile');
  //     return;
  //   }
  //   setError(null);

  //   try {
  //     const user = localStorage.getItem('user');
  //     let tenantId = '';
  //     if (user) {
  //       try {
  //         const userData = JSON.parse(user);
  //         tenantId = userData.tenantId || '';
  //       } catch { }
  //     }

  //     if (!tenantId) {
  //       setError('Tenant ID is required to generate profile');
  //       return;
  //     }

  //     const request: GenerateProfileRequest = {
  //       tenantId,
  //     };

  //     const response = await profileService.generateProfile(request);
  //     setProfileData(response);

  //     // if (onSaveProfile) {
  //     //   onSaveProfile({
  //     //     generatedAt: new Date().toLocaleString(),
  //     //     totalVolume: `$${response.metrics?.totalValue?.toLocaleString() ?? '0'}`,
  //     //     anomalies: response.detectedAnomalies?.length ?? 0,
  //     //     riskLevel: determineRiskLevel(response.detectedAnomalies ?? []),
  //     //     notes: response.notes,
  //     //   });
  //     // }
  //   } catch (err: any) {
  //     setError(err.message ?? 'Failed to generate profile');
  //   }
  // };

  // const determineRiskLevel = (anomalies: Array<{ risk: string }>): string => {
  //   if (!anomalies || anomalies.length === 0) return 'Low';
  //   const highRiskCount = anomalies.filter(a => a.risk === 'High').length;
  //   if (highRiskCount > 0) return 'High';
  //   const mediumRiskCount = anomalies.filter((a) => a.risk === 'Medium').length;
  //   if (mediumRiskCount > 0) return 'Medium';
  //   return 'Low';
  // };

  // const handleSaveProfile = () => {
  //   if (profileData) {
  //     if (onSaveProfile) {
  //       onSaveProfile({
  //         generatedAt: new Date().toLocaleString(),
  //         totalVolume: `$${profileData.metrics?.totalValue?.toLocaleString() ?? '0'}`,
  //         anomalies: profileData.detectedAnomalies?.length ?? 0,
  //         riskLevel: determineRiskLevel(profileData.detectedAnomalies ?? []),
  //         notes,
  //       });
  //     }
  //   }
  //   onClose();
  // };

  // const displayData = profileData ?? {
  //   metrics: {
  //     totalVolume: 4,
  //     totalValue: 14200,
  //     avgTicketSize: 3550,
  //     crossBorderCount: 2,
  //     entityId: 'NA',
  //     entityName: 'NA',
  //     entityRole: activeTab === 'creditor' ? 'Creditor' : 'Debitor',
  //     transactionCurrency: 'USD',
  //     transactionType: 'Transfer',
  //     entityType: 'Individual',
  //   },
  //   detectedAnomalies: anomaliesData,
  // };

  // const display = React.useMemo(() => {
  //   if (!profileData) return null;

  //   return activeTab === 'creditor'
  //     ? profileData.creditorProfile
  //     : profileData.debitorProfile;
  // }, [profileData, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!alertId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Select an alert to view navigator details</p>
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
            onClick={() => setActiveTab('creditor')}
            className={`px-4 py-1.5 text-sm rounded-md transition ${activeTab === 'creditor'
              ? 'bg-white shadow text-blue-600 font-medium'
              : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            Creditor
          </button>

          <button
            onClick={() => setActiveTab('debtor')}
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
        {activeTab === 'creditor' ? 'Creditor Profile' : 'Debitor Profile'}
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
              <h3 className="text-xs font-medium text-gray-500">
                Total Value
              </h3>
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
              <p className="mt-1 text-xs text-gray-500">
                Transaction count
              </p>
            </div>

            {/* Transaction Currency Card */}
            {/* <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-medium text-gray-500">
                Transaction Currency
              </h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {selectedData?.tx_ccy ?? 'N/A'}
              </p>
            </div>

            { /* Transaction Type Card */}
            {/* <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-medium text-gray-500">
                Transaction Type
              </h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {selectedData?.tx_type ?? 'N/A'}
              </p>
            </div> */}

            {/* Anomalies Detected Card */}
            {/* <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">
                  Anomalies Detected
                </h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {displayData.detectedAnomalies?.length ?? 0}
                </p>
                <p className="mt-1 text-xs text-orange-600">
                  Risk Level:{' '}
                  {determineRiskLevel(displayData.detectedAnomalies ?? [])}
                </p>
              </div> */}
          </div>

          {/* Transaction Volume Trend Chart */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Transaction Volume Trend (90 Days)</h3>
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
                  <Area type="monotone" dataKey="volume" stroke="#3b82f6" fill="#93c5fd" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Daily Transaction Count Chart */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Daily Transaction Count</h3>
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
                        onClick={() => handleSort('event_date')}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        Date {getSortIcon('event_date')}
                      </th>
                      <th
                        onClick={() => handleSort('tx_amount')}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        Transaction Amount {getSortIcon('tx_amount')}

                      </th>
                      <th
                        onClick={() => handleSort('tx_ccy')}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        Transaction Currency {getSortIcon('tx_ccy')}
                      </th>
                      <th
                        onClick={() => handleSort('tx_type')}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        Transaction Type {getSortIcon('tx_type')}
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedTransactions.map((tx: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(tx.event_date).toLocaleDateString()}
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detected Anomalies Table */}
          {/* <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Detected Anomalies &amp; Flagged Patterns</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {(displayData.detectedAnomalies || []).map((anomaly: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{anomaly.date}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{anomaly.type}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          ${typeof anomaly.amount === 'number' ? anomaly.amount.toLocaleString() : anomaly.amount}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{anomaly.description}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${anomaly.risk === 'High'
                              ? 'bg-red-100 text-red-800'
                              : anomaly.risk === 'Medium'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                              }`}
                          >
                            {anomaly.risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div> */}
        </div>
      </div>
    </div>
  );
};

export default ProfileOverviewTab;
