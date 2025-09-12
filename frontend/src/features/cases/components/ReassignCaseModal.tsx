import React from 'react';
import type { CaseRow } from './CasesTable';

interface ReassignCaseModalProps {
  open: boolean;
  onClose: () => void;
  onReassign: (row: CaseRow, assignee: string, justification?: string) => void;
  row?: CaseRow | null;
}

const ReassignCaseModal: React.FC<ReassignCaseModalProps> = ({ open, onClose, onReassign, row }) => {
  const [assignee, setAssignee] = React.useState('');
  const [justification, setJustification] = React.useState('');
  React.useEffect(() => {
    setAssignee('');
    setJustification('');
  }, [row, open]);

  if (!open || !row) return null;

  const canConfirm = Boolean(assignee && justification.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
<<<<<<< HEAD
        <div className="px-6 py-4">
=======
        <div className="border-b px-6 py-4">
>>>>>>> b610ca14c62be40a6b4464adec8d2995e9c999d7
          <h3 className="text-lg font-semibold text-gray-900">Reassign Case</h3>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Case ID</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{row.id}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Assignee</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{row.assignee || '—'}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reassign To</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select Investigator</option>
              <option value="John Smith">John Smith</option>
              <option value="Sarah Johnson">Sarah Johnson</option>
              <option value="Michael Brown">Michael Brown</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Justification</label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => onReassign(row, assignee, justification)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              disabled={!canConfirm}
            >
              Confirm Reassignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReassignCaseModal;
