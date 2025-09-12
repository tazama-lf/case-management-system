import React from 'react';
import { ArrowDownTrayIcon, ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './CasesTable';
import CollaborateButton from './view/CollaborateButton';
import CollaboratePanel from './view/CollaboratePanel';
import EvidenceDocumentsTab from './view/EvidenceDocumentsTab';
import LinkedItemsTab from './view/LinkedItemsTab';
import TaskLogTab from './view/TaskLogTab';
import InvestigationNotesTab from './view/InvestigationNotesTab';
import CaseDetailsTab from './view/CaseDetailsTab';

interface ViewCaseModalProps {
  open: boolean;
  onClose: () => void;
  row?: CaseRow | null;
}

const ViewCaseModal: React.FC<ViewCaseModalProps> = ({ open, onClose, row }) => {
  const [tab, setTab] = React.useState<'details' | 'evidence' | 'linked' | 'tasks' | 'notes'>('details');
  const [showCollaborate, setShowCollaborate] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTab('details');
      setShowCollaborate(false);
    }
  }, [open]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-5xl rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{showCollaborate ? 'Case Collaboration' : 'Case Details'}</h3>
            <CollaborateButton onClick={() => setShowCollaborate(true)} />
            {showCollaborate && (
              <button
                onClick={() => setShowCollaborate(false)}
                className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
                title="Back to Details"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>
            )}
            <button className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-gray-700 shadow-sm hover:bg-gray-50" title="Download">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </button>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        {!showCollaborate && (
          <div className="flex items-center gap-2 px-6 pt-3">
            {[
              { key: 'details', label: 'Case Details' },
              { key: 'evidence', label: 'Evidence & Documents' },
              { key: 'linked', label: 'Linked Items' },
              { key: 'tasks', label: 'Task Log' },
              { key: 'notes', label: 'Investigation Notes' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`-mb-px rounded-t-md px-3 py-2 text-sm font-medium ${
                  tab === t.key ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {showCollaborate ? (
            <CollaboratePanel />
          ) : (
            <>
              {tab === 'details' && <CaseDetailsTab row={row} />}
              {tab === 'evidence' && <EvidenceDocumentsTab />}
              {tab === 'linked' && <LinkedItemsTab />}
              {tab === 'tasks' && <TaskLogTab />}
              {tab === 'notes' && <InvestigationNotesTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewCaseModal;
