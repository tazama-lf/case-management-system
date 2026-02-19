import React from 'react';

interface TransactionRow {
  id: string;
  date: string;
  type: string;
  amount: string;
  status: string;
  jurisdiction: string;
  reason: string;
}

interface TransactionsTableProps {
  transactions: TransactionRow[];
}

export const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions }) => {
  const getStatusColor = (status: string): string => {
    if (status === 'COMPLIANT') return 'bg-green-100 text-green-800';
    if (status === 'REVIEW') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Jurisdiction</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {transactions.map((txn) => (
            <tr key={txn.id} className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm font-medium text-gray-900">{txn.id}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{txn.date}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{txn.type}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{txn.amount}</td>
              <td className="px-6 py-3 text-sm">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(txn.status)}`}>
                  {txn.status}
                </span>
              </td>
              <td className="px-6 py-3 text-sm text-gray-600">{txn.jurisdiction}</td>
              <td className="px-6 py-3 text-sm text-gray-600">{txn.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
