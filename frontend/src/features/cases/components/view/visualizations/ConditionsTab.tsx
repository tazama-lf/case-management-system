import React, { useState } from 'react';

interface ConditionsTabProps {
  caseId?: string;
  transactionId?: string;
}

// Mock data
const mockConditions = [
  {
    id: 1,
    title: 'SANCTIONS SCREENING match - OSINT-544',
    type: 'SANCTIONS',
    startDate: '2024-05-15',
    endDate: null,
    status: 'No reply',
    severity: 'high',
  },
  {
    id: 2,
    title: 'Approved high-value transaction details',
    type: 'APPROVED',
    startDate: '2024-05-01',
    endDate: '2024-05-20',
    status: 'Approved',
    severity: 'low',
  },
];

const mockTimelineEvents = [
  { id: 1, label: 'FROM 05', color: 'bg-red-100 border-red-300' },
  { id: 2, label: 'COND 08', color: 'bg-green-100 border-green-300' },
  { id: 3, label: 'ORDER 023', color: 'bg-gray-100 border-gray-300' },
  { id: 4, label: 'COND 804', color: 'bg-purple-100 border-purple-300' },
];

const mockTransactions = [
  {
    id: 'TXN-001',
    date: '2024-04-07',
    type: 'Transfer',
    amount: '$2,500',
    status: 'COMPLIANT',
    jurisdiction: 'CIND-001',
    reason: 'No condition triggered',
  },
  {
    id: 'TXN-002',
    date: '2024-03-15',
    type: 'Transfer',
    amount: '$5,500',
    status: 'REVIEW',
    jurisdiction: 'CIND-003',
    reason: 'No condition triggered',
  },
  {
    id: 'TXN-003',
    date: '2024-03-10',
    type: 'Wire Transfer',
    amount: '$15,000',
    status: 'COMPLIANT',
    jurisdiction: 'CIND-001',
    reason: 'Sanctions screening match',
  },
  {
    id: 'TXN-004',
    date: '2024-02-21',
    type: 'Transfer',
    amount: '$35,000',
    status: 'COMPLIANT',
    jurisdiction: 'CIND-001',
    reason: 'Sanctions screening match',
  },
];

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [timeRange, setTimeRange] = useState('Last 30 Days');

  const timeRangeOptions = [
    'Last 30 Days',
    'Last 60 Days',
    'Last 90 Days',
    'Last 6 Months',
    'Last Year',
    'All Time',
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header with Filter */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Conditions View
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Conditions and conditions for {caseId || transactionId || 'ACT-1234'}
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
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Active Conditions
          </div>
          <div className="text-2xl font-bold text-red-600">3</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Blocked Transactions
          </div>
          <div className="text-2xl font-bold text-orange-600">2</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Approved Transactions
          </div>
          <div className="text-2xl font-bold text-green-600">2</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Review Conditions
          </div>
          <div className="text-2xl font-bold text-purple-600">1</div>
        </div>
      </div>

      {/* Active Conditions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Active Conditions
        </h3>
        <div className="space-y-3">
          {mockConditions.map((condition) => (
            <div
              key={condition.id}
              className={`rounded-lg border-l-4 p-4 ${
                condition.severity === 'high'
                  ? 'border-l-red-500 bg-red-50'
                  : 'border-l-green-500 bg-green-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {condition.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Start Date: {condition.startDate}
                    {condition.endDate && ` | End Date: ${condition.endDate}`}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    condition.status === 'No reply'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {condition.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-6">
          Conditions Timeline
        </h3>
        <div className="flex items-center justify-between gap-4">
          {mockTimelineEvents.map((event) => (
            <div key={event.id} className="flex flex-col items-center gap-2">
              <div
                className={`border-2 rounded-lg px-4 py-2 text-xs font-semibold text-gray-700 ${event.color}`}
              >
                {event.label}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span className="text-xs text-gray-600">FROM</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-xs text-gray-600">COND</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="text-xs text-gray-600">ORDER</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span className="text-xs text-gray-600">COND</span>
          </div>
        </div>
      </div>

      {/* Evaluated Transactions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Evaluated Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Transaction ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Jurisdiction
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {mockTransactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-900 font-semibold">
                    {txn.id}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{txn.date}</td>
                  <td className="px-4 py-3 text-gray-600">{txn.type}</td>
                  <td className="px-4 py-3 text-gray-600">{txn.amount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        txn.status === 'COMPLIANT'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{txn.jurisdiction}</td>
                  <td className="px-4 py-3 text-gray-600">{txn.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Earned & Future Conditions */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Earned Conditions
          </h3>
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
            <p className="text-sm text-gray-700 font-medium">
              Geographic risk - high jurisdiction
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Active since 2024-01-15 | Updated 2024-05-20
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Future Conditions
          </h3>
          <div className="rounded-lg border border-purple-300 bg-purple-50 p-4">
            <p className="text-sm text-gray-700 font-medium">
              Pre-approved vendor payment schedule
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Effective from 2024-06-01 | Scheduled review 2024-07-15
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionsTab;
