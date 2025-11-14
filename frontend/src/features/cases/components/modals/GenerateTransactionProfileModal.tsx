import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface GenerateTransactionProfileModalProps {
  open: boolean;
  onClose: () => void;
}

// Sample data for the charts
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

const GenerateTransactionProfileModal: React.FC<GenerateTransactionProfileModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-7xl rounded-lg bg-white shadow-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Generate Transaction Profile</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              {/* Total Volume Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">Total Volume</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">$352,380</p>
                <p className="mt-1 text-xs text-gray-500">90-day period</p>
              </div>

              {/* Avg Daily Amount Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">Avg Daily Amount</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">$3,915</p>
                <p className="mt-1 text-xs text-green-600">+39.8% vs peer avg</p>
              </div>

              {/* Total Transactions Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">Total Transactions</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">472</p>
                <p className="mt-1 text-xs text-gray-500">Avg: $747</p>
              </div>

              {/* Anomalies Detected Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-medium text-gray-500">Anomalies Detected</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">9</p>
                <p className="mt-1 text-xs text-orange-600">Risk Level: Medium</p>
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
                    {anomaliesData.map((anomaly) => (
                      <tr key={anomaly.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{anomaly.date}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{anomaly.type}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          {anomaly.amount}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{anomaly.description}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Investigator Analysis & Notes */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Investigator Analysis &amp; Notes</h3>
              <textarea
                rows={6}
                placeholder="Add your analysis, observations, and notes about the transaction profile..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Save Profile to Case
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateTransactionProfileModal;
