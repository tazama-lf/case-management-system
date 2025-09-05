import React from 'react';

export type CaseRow = {
  id: number;
  type: string;
  typeColor: string; // tailwind ring/background text classes
  status: string;
  statusColor: string; // tailwind classes
  typologyId: string;
  score: number;
  createdOn: string;
  pickedOn: string;
  action: 'View' | 'Complete';
  reassignEnabled: boolean;
  assignee?: string;
};

interface CasesTableProps {
  rows: CaseRow[];
  onView: (row: CaseRow) => void;
  onComplete: (row: CaseRow) => void;
  onReassign: (row: CaseRow) => void;
}

const CasesTable: React.FC<CasesTableProps> = ({ rows, onView, onComplete, onReassign }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Case ID</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Case Type</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typology ID</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typology Score</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created on</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Picked on</th>
            <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{c.id}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${c.typeColor}`}>
                  {c.type}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${c.statusColor}`}>
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{c.typologyId}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{c.score}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{c.createdOn}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{c.pickedOn}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex justify-end gap-2">
                  {c.action === 'Complete' ? (
                    <button
                      onClick={() => onComplete(c)}
                      className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Complete
                    </button>
                  ) : (
                    <button
                      onClick={() => onView(c)}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      View
                    </button>
                  )}
                  <button
                    onClick={() => onReassign(c)}
                    className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                    disabled={!c.reassignEnabled}
                  >
                    Reassign
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CasesTable;
