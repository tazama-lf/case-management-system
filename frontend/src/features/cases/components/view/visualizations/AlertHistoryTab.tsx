import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AlertHistoryTabProps {
  caseId?: string;
  transactionId?: string;
}

// Mock data
const mockAlerts = [
  {
    id: 'AL1-2024-481234',
    date: '2024-01-15',
    type: 'Structuring',
    severity: 'High',
    status: 'Investigated',
    caseId: 'CASE-2024-0045',
    outcome: 'SAR Filed',
    actions: 'View Details',
  },
  {
    id: 'AL1-2024-481189',
    date: '2024-01-10',
    type: 'Rapid Movement',
    severity: 'Medium',
    status: 'Closed',
    caseId: 'CASE-2024-0042',
    outcome: 'False Positive',
    actions: 'View Details',
  },
  {
    id: 'AL1-2024-481156',
    date: '2024-01-05',
    type: 'High Value',
    severity: 'High',
    status: 'Investigated',
    caseId: 'CASE-2024-0038',
    outcome: 'Under Review',
    actions: 'View Details',
  },
];

const mockCountData = [
  { date: 'Oct 25', alerts: 2, cases: 1, investigations: 1 },
  { date: 'Oct 29', alerts: 3, cases: 2, investigations: 2 },
  { date: 'Nov 2', alerts: 4, cases: 3, investigations: 3 },
  { date: 'Nov 5', alerts: 2, cases: 1, investigations: 2 },
  { date: 'Nov 8', alerts: 3, cases: 2, investigations: 1 },
  { date: 'Nov 12', alerts: 5, cases: 3, investigations: 3 },
];

const mockValueData = [
  { date: 'Oct 25', value: 52000 },
  { date: 'Oct 29', value: 48000 },
  { date: 'Nov 2', value: 61000 },
  { date: 'Nov 5', value: 35000 },
  { date: 'Nov 8', value: 44000 },
  { date: 'Nov 12', value: 58000 },
];

const AlertHistoryTab: React.FC<AlertHistoryTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [timeRange, setTimeRange] = useState('Last 90 Days');

  const timeRangeOptions = [
    'Last 30 Days',
    'Last 60 Days',
    'Last 90 Days',
    'Last 6 Months',
    'Last Year',
    'All History',
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header with Filter */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Alert History View
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Historical alerts, cases, investigations, and SAR/STR filings for{' '}
            {caseId || transactionId || 'ACT-1234'}
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {timeRangeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Total Alerts
          </div>
          <div className="text-2xl font-bold text-gray-900">171</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Cases Opened
          </div>
          <div className="text-2xl font-bold text-blue-600">40</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Investigations
          </div>
          <div className="text-2xl font-bold text-purple-600">93</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            SAR/STR Filings
          </div>
          <div className="text-2xl font-bold text-red-600">2</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Total Value
          </div>
          <div className="text-2xl font-bold text-gray-900">
            $3,331,967
          </div>
        </div>
      </div>

      {/* Alert Count Over Time Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Alert Count Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={mockCountData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="alerts"
              stroke="#ef4444"
              name="Alerts"
            />
            <Line
              type="monotone"
              dataKey="cases"
              stroke="#3b82f6"
              name="Cases"
            />
            <Line
              type="monotone"
              dataKey="investigations"
              stroke="#8b5cf6"
              name="Investigations"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alert Value Over Time Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Alert Value Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={mockValueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#10b981" name="Value" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alert History Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Alert History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Alert ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Severity
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Case ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Outcome
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mockAlerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-900">{alert.id}</td>
                  <td className="px-4 py-3 text-gray-600">{alert.date}</td>
                  <td className="px-4 py-3 text-gray-600">{alert.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        alert.severity === 'High'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        alert.status === 'Investigated'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-blue-600">{alert.caseId}</td>
                  <td className="px-4 py-3 text-gray-600">{alert.outcome}</td>
                  <td className="px-4 py-3">
                    <a
                      href="AlertNavigatorTab"
                      className="text-blue-600 hover:underline"
                    >
                      {alert.actions}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AlertHistoryTab;
