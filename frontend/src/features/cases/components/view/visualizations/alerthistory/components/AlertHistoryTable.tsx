import React from 'react';

interface AlertHistoryTableProps {
  data: Array<{
    id: string;
    date: string;
    type: string;
    severity: 'High' | 'Medium' | 'Low';
    status: string;
    caseId: string;
    outcome: string;
    actions: string;
  }>;
}

export const AlertHistoryTable: React.FC<AlertHistoryTableProps> = ({ data }) => {
  const getSeverityColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string): string => {
    if (status.includes('Investigated')) return 'text-blue-600';
    if (status.includes('Closed')) return 'text-gray-600';
    return 'text-yellow-600';
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Alert ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Severity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.id}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{row.date}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{row.type}</td>
              <td className="px-6 py-3 text-sm">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(row.severity)}`}>
                  {row.severity}
                </span>
              </td>
              <td className={`px-6 py-3 text-sm font-medium ${getStatusColor(row.status)}`}>{row.status}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{row.caseId}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{row.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
