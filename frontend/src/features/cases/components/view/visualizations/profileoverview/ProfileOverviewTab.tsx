import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
  type TransactionProfile,
  type GenerateProfileRequest,
} from '../../../../services/profileService';

interface ProfileOverviewTabProps {
  alertId?: number;
  transactionId?: string;
}

//Error Handling is missing, add that. Hard Coded Data should not be shown to the user.
const volumeTrendData = [
  { date: 'Week 1', volume: 25000 },
  { date: 'Week 2', volume: 28000 },
  { date: 'Week 3', volume: 31000 },
  { date: 'Week 4', volume: 27000 },
  { date: 'Week 5', volume: 35000 },
  { date: 'Week 6', volume: 38000 },
  { date: 'Week 7', volume: 42000 },
  { date: 'Week 8', volume: 39000 },
  { date: 'Week 9', volume: 45000 },
  { date: 'Week 10', volume: 48000 },
  { date: 'Week 11', volume: 43000 },
  { date: 'Week 12', volume: 51380 },
];

const transactionCountData = [
  { day: 'Mon', count: 52 },
  { day: 'Tue', count: 48 },
  { day: 'Wed', count: 61 },
  { day: 'Thu', count: 55 },
  { day: 'Fri', count: 73 },
  { day: 'Sat', count: 39 },
  { day: 'Sun', count: 28 },
];

const anomaliesData = [
  {
    id: 1,
    date: '2024-11-10',
    type: 'Large Transfer',
    amount: '$45,000',
    description: 'Single transaction exceeds 90-day average by 600%',
    risk: 'High',
  },
  {
    id: 2,
    date: '2024-11-08',
    type: 'Rapid Succession',
    amount: '$12,300',
    description: '7 transactions within 15 minutes',
    risk: 'Medium',
  },
  {
    id: 3,
    date: '2024-11-05',
    type: 'Unusual Pattern',
    amount: '$8,750',
    description: 'Transaction time outside normal hours (3:42 AM)',
    risk: 'Medium',
  },
  {
    id: 4,
    date: '2024-11-03',
    type: 'Round Amount',
    amount: '$10,000',
    description: 'Exact round amount transaction',
    risk: 'Low',
  },
  {
    id: 5,
    date: '2024-10-28',
    type: 'New Recipient',
    amount: '$15,200',
    description: 'Large transfer to previously unknown recipient',
    risk: 'Medium',
  },
];

const ProfileOverviewTab: React.FC<
  ProfileOverviewTabProps
> = ({ alertId, transactionId }) => {
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] =
    useState<TransactionProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'creditor' | 'debitor'>('creditor');


  useEffect(() => {
    if (!alertId) {
      setError('Alert ID is required to generate profile');
      setLoading(false);
      return;
    }

    setError(null);

    const fetchData = async () => {



      try {

        setLoading(true);
        setError(null);
        setProfileData(null);
        setError(null);
        const user = localStorage.getItem('user');
        let tenantId = '';
        if (user) {
          try {
            const userData = JSON.parse(user);
            tenantId = userData.tenantId || '';
          } catch { }
        }

        if (!tenantId) {
          setError('Tenant ID is required to generate profile');
          return;
        }

        const request: GenerateProfileRequest = {
          tenantId,
        };

        const response = await profileService.generateProfile(request);
        setProfileData(response);

        // if (onSaveProfile) {
        //   onSaveProfile({
        //     generatedAt: new Date().toLocaleString(),
        //     totalVolume: `$${response.metrics?.totalValue?.toLocaleString() ?? '0'}`,
        //     anomalies: response.detectedAnomalies?.length ?? 0,
        //     riskLevel: determineRiskLevel(response.detectedAnomalies ?? []),
        //     notes: response.notes,
        //   });
        // }
      } catch (err: any) {
        setError(err.message ?? 'Failed to generate profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [alertId]);

  if (!alertId || !transactionId) return null;



  const handleGenerateProfile = async () => {
    if (!alertId) {
      setError('Alert ID is required to generate profile');
      return;
    }
    setError(null);

    try {
      const user = localStorage.getItem('user');
      let tenantId = '';
      if (user) {
        try {
          const userData = JSON.parse(user);
          tenantId = userData.tenantId || '';
        } catch { }
      }

      if (!tenantId) {
        setError('Tenant ID is required to generate profile');
        return;
      }

      const request: GenerateProfileRequest = {
        tenantId,
      };

      const response = await profileService.generateProfile(request);
      setProfileData(response);

      // if (onSaveProfile) {
      //   onSaveProfile({
      //     generatedAt: new Date().toLocaleString(),
      //     totalVolume: `$${response.metrics?.totalValue?.toLocaleString() ?? '0'}`,
      //     anomalies: response.detectedAnomalies?.length ?? 0,
      //     riskLevel: determineRiskLevel(response.detectedAnomalies ?? []),
      //     notes: response.notes,
      //   });
      // }
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate profile');
    }
  };

  const determineRiskLevel = (anomalies: Array<{ risk: string }>): string => {
    if (!anomalies || anomalies.length === 0) return 'Low';
    const highRiskCount = anomalies.filter(a => a.risk === 'High').length;
    if (highRiskCount > 0) return 'High';
    const mediumRiskCount = anomalies.filter((a) => a.risk === 'Medium').length;
    if (mediumRiskCount > 0) return 'Medium';
    return 'Low';
  };

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

  const displayData = profileData ?? {
    metrics: {
      totalVolume: 4,
      totalValue: 14200,
      avgTicketSize: 3550,
      crossBorderCount: 2,
      entityId: 'NA',
      entityName: 'NA',
      entityRole: activeTab === 'creditor' ? 'Creditor' : 'Debitor',
      transactionCurrency: 'USD',
      transactionType: 'Transfer',
      entityType: 'Individual',
    },
    detectedAnomalies: anomaliesData,
  };

  // const display = React.useMemo(() => {
  //   if (!profileData) return null;

  //   return activeTab === 'creditor'
  //     ? profileData.creditorProfile
  //     : profileData.debitorProfile;
  // }, [profileData, activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Profile Overview</h3>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-md w-fit">
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
          onClick={() => setActiveTab('debitor')}
          className={`px-4 py-1.5 text-sm rounded-md transition ${activeTab === 'debitor'
            ? 'bg-white shadow text-blue-600 font-medium'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          Debitor
        </button>
      </div>

      <h3 className="text-sm font-semibold text-gray-900">
        {activeTab === 'creditor' ? 'Creditor Profile' : 'Debitor Profile'}
      </h3>

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
              <p className="mt-4 text-sm text-gray-600">
                Loading profile data...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">
                Entity Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Entity ID</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {displayData.metrics?.entityId ?? 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Entity Name</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {displayData.metrics?.entityName ?? 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Entity Role</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {displayData.metrics?.entityRole ?? 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Entity Type</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {displayData.metrics?.entityType ?? 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">
                  Total Value
                </h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  ${displayData.metrics?.totalValue?.toLocaleString() ?? '0'}
                </p>
                <p className="mt-1 text-xs text-gray-500">Transaction sum</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">
                  Total Transactions
                </h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {displayData.metrics?.totalVolume?.toLocaleString() || '0'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Transaction count
                </p>
              </div>

              {/* Transaction Currency Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">
                  Transaction Currency
                </h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {displayData.metrics?.transactionCurrency ?? 'N/A'}
                </p>
              </div>

              { /* Transaction Type Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">
                  Transaction Type
                </h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {displayData.metrics?.transactionType ?? 'N/A'}
                </p>
              </div>

              {/* Anomalies Detected Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
              </div>
            </div>

            {/* Transaction Volume Trend Chart */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Transaction Volume Trend (90 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={volumeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="volume" stroke="#3b82f6" fill="#93c5fd" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Transaction Count Chart */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Daily Transaction Count</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={transactionCountData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detected Anomalies Table */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
                    {(displayData.detectedAnomalies || []).map((anomaly, index) => (
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileOverviewTab;
