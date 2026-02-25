import React from 'react';
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
} from '../../services/profileService';

interface GenerateTransactionProfileModalProps {
  open: boolean;
  onClose: () => void;
  caseId?: string;
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

const GenerateTransactionProfileModal: React.FC<
  GenerateTransactionProfileModalProps
> = ({ open, onClose, caseId, onSaveProfile, initialProfile }) => {
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [notes, setNotes] = React.useState(initialProfile?.notes || '');
  const [profileData, setProfileData] =
    React.useState<TransactionProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<'initial' | 'generated'>('initial');

  React.useEffect(() => {
    if (open && caseId && !initialProfile) {
      setLoading(true);
      setError(null);
      setStep('initial');
      setProfileData(null);
      profileService
        .getProfile(caseId)
        .then((data) => {
          setProfileData(data);
          setNotes(data.notes || '');
          setStep('generated');
        })
        .catch(() => {
          setProfileData(null);
          setStep('initial');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, caseId, initialProfile]);

  if (!open) return null;

  const isViewMode = !!initialProfile || !!profileData;

  const handleGenerateProfile = async () => {
    if (!caseId) {
      setError('Case ID is required to generate profile');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const user = localStorage.getItem('user');
      let tenantId = '';
      if (user) {
        try {
          const userData = JSON.parse(user);
          tenantId = userData.tenantId || '';
        } catch {
          // Ignore JSON parse errors and use default tenantId
        }
      }

      if (!tenantId) {
        setError('Tenant ID is required to generate profile');
        setSaving(false);
        return;
      }

      const request: GenerateProfileRequest = {
        tenantId,
        notes,
      };

      const response = await profileService.generateProfile(request);
      setProfileData(response);
      setStep('generated');

      if (onSaveProfile) {
        onSaveProfile({
          generatedAt: new Date().toLocaleString(),
          totalVolume: `$${response.metrics?.totalValue?.toLocaleString() || '0'}`,
          anomalies: response.detectedAnomalies?.length || 0,
          riskLevel: determineRiskLevel(response.detectedAnomalies || []),
          notes: response.notes,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate profile');
    } finally {
      setSaving(false);
    }
  };

  const determineRiskLevel = (anomalies: Array<{ risk: string }>): string => {
    if (!anomalies || anomalies.length === 0) return 'Low';
    const highRiskCount = anomalies.filter((a) => a.risk === 'High').length;
    if (highRiskCount > 0) return 'High';
    const mediumRiskCount = anomalies.filter((a) => a.risk === 'Medium').length;
    if (mediumRiskCount > 0) return 'Medium';
    return 'Low';
  };

  const handleSaveProfile = () => {
    if (profileData) {
      if (onSaveProfile) {
        onSaveProfile({
          generatedAt: new Date().toLocaleString(),
          totalVolume: `$${profileData.metrics?.totalValue?.toLocaleString() || '0'}`,
          anomalies: profileData.detectedAnomalies?.length || 0,
          riskLevel: determineRiskLevel(profileData.detectedAnomalies || []),
          notes,
        });
      }
    }
    onClose();
  };

  const displayData = profileData || {
    metrics: {
      totalVolume: 4,
      totalValue: 14200,
      avgTicketSize: 3550,
      crossBorderCount: 2,
    },
    detectedAnomalies: anomaliesData,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-6xl rounded-lg bg-white shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isViewMode
              ? 'Transaction Profile'
              : 'Generate Transaction Profile'}
          </h2>
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
                <p className="mt-4 text-sm text-gray-600">
                  Loading profile data...
                </p>
              </div>
            </div>
          ) : step === 'initial' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3v18h18"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 15l4-4 4 4"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Ready to Generate Transaction Profile
              </h3>
              <p className="text-base text-gray-600 mb-6 max-w-xl text-center">
                Analyze 90 days of transaction data, calculate peer deviations,
                and identify anomalies or patterns suggesting layering or
                structuring activities.
              </p>
              <div className="w-full max-w-xs mx-auto text-left space-y-3 mb-8">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-blue-600 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  <span className="text-sm text-gray-900">
                    Transaction Trends
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-blue-600 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-sm text-gray-900">
                    Anomaly Detection
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-blue-600 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span className="text-sm text-gray-900">Peer Comparison</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-blue-600 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm text-gray-900">
                    Investigator Notes
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-6 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateProfile}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-base font-semibold text-white shadow-sm hover:bg-blue-700"
                  disabled={saving}
                >
                  {saving ? 'Generating...' : 'Generate Profile'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-medium text-gray-500">
                    Total Value
                  </h3>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    ${displayData.metrics?.totalValue?.toLocaleString() || '0'}
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

                {/* Avg Ticket Size Card */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-medium text-gray-500">
                    Avg Ticket Size
                  </h3>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    $
                    {displayData.metrics?.avgTicketSize?.toLocaleString() ||
                      '0'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Cross-border: {displayData.metrics?.crossBorderCount || 0}
                  </p>
                </div>

                {/* Anomalies Detected Card */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-medium text-gray-500">
                    Anomalies Detected
                  </h3>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {displayData.detectedAnomalies?.length || 0}
                  </p>
                  <p className="mt-1 text-xs text-orange-600">
                    Risk Level:{' '}
                    {determineRiskLevel(displayData.detectedAnomalies || [])}
                  </p>
                </div>
              </div>

              {/* Transaction Volume Trend Chart */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">
                  Transaction Volume Trend (90 Days)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={volumeTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
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
              </div>

              {/* Daily Transaction Count Chart */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">
                  Daily Transaction Count
                </h3>
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
                <h3 className="mb-4 text-sm font-semibold text-gray-900">
                  Detected Anomalies &amp; Flagged Patterns
                </h3>
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
                      {(displayData.detectedAnomalies || []).map(
                        (anomaly, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {anomaly.date}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {anomaly.type}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                              $
                              {typeof anomaly.amount === 'number'
                                ? anomaly.amount.toLocaleString()
                                : anomaly.amount}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {anomaly.description}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                  anomaly.risk === 'High'
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
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Investigator Analysis & Notes */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Investigator Analysis &amp; Notes
                </h3>
                {isViewMode ? (
                  <div className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded p-3 border border-gray-100 min-h-[80px]">
                    {notes ? (
                      notes
                    ) : (
                      <span className="italic text-gray-400">
                        No notes provided.
                      </span>
                    )}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                    }}
                    placeholder="Add your analysis, observations, and notes about the transaction profile..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            disabled={saving}
          >
            {step === 'initial' ? 'Cancel' : 'Close'}
          </button>
          {step === 'initial' && (
            <button
              type="button"
              onClick={handleGenerateProfile}
              className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={saving || !caseId}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {saving ? 'Generating...' : 'Generate Profile'}
            </button>
          )}
          {isViewMode && (
            <button
              type="button"
              onClick={handleSaveProfile}
              className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Profile to Case'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateTransactionProfileModal;
