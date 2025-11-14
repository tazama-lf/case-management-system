import React from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
// import CollaborateButton from './view/CollaborateButton';
import CollaboratePanel from './view/CollaboratePanel';
import TaskEvidenceTab from './view/TaskEvidenceTab';
import LinkedItemsTab from './view/LinkedItemsTab';
import InvestigationNotesTab from './view/InvestigationNotesTab';
import CaseDetailsTab from './view/CaseDetailsTab';
import CustomerProfileTab from './view/CustomerProfileTab';

type ViewTabKey = 'details' | 'evidence' | 'linked' | 'tasks' | 'notes' | 'customer';

interface TaskDetailsModalProps {
  open: boolean;
  onClose: () => void;
  row?: CaseRow | null;
  onRefreshCases?: () => Promise<void>;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  open,
  onClose,
  row,
  onRefreshCases,
}) => {
  const [tab, setTab] = React.useState<ViewTabKey>('details');
  const [showCollaborate, setShowCollaborate] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTab('details');
      setShowCollaborate(false);
      window.scrollTo({ top: 0 });
    }
  }, [open]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-5xl rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        {}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {showCollaborate ? 'Case Collaboration' : 'Task Details'}
            </h3>
            {/* <CollaborateButton onClick={() => setShowCollaborate(true)} />
            {showCollaborate && (
              <button
                onClick={() => setShowCollaborate(false)}
                className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
                title="Back to Details"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>
            )} */}
            {/* <button className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50" title="Download">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </button> */}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {}
        {!showCollaborate && (
          <div className="flex items-center gap-2 px-6 pt-3">
            {(
              [
                { key: 'details', label: 'Task Details' },
                { key: 'linked', label: 'Linked Items' },
                { key: 'customer', label: 'Customer Profile' },
                { key: 'evidence', label: 'Evidence' },
                { key: 'notes', label: 'Investigation Notes' },
              ] satisfies Array<{ key: ViewTabKey; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px rounded-t-md px-3 py-2 text-sm font-medium ${
                  tab === t.key
                    ? 'border-b-2 border-indigo-600 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {showCollaborate ? (
            <CollaboratePanel />
          ) : (
            <>
              <div style={{ display: tab === 'details' ? 'block' : 'none' }}>
                <CaseDetailsTab row={row} />
              </div>
              <div style={{ display: tab === 'customer' ? 'block' : 'none' }}>
                <CustomerProfileTab />
              </div>
              <div style={{ display: tab === 'evidence' ? 'block' : 'none' }}>
                <TaskEvidenceTab />
              </div>
              <div style={{ display: tab === 'linked' ? 'block' : 'none' }}>
                <LinkedItemsTab />
              </div>
              <div style={{ display: tab === 'notes' ? 'block' : 'none' }}>
                <InvestigationNotesTab />
              </div>
            </>
          )}
        </div>

        {}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-1 focus:ring-gray-400"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            Close
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-1 focus:ring-blue-600"
          >
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
