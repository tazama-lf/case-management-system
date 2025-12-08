import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
import CollaboratePanel from './view/CollaboratePanel';
import EvidenceDocumentsTab from './view/EvidenceDocumentsTab';
import LinkedItemsTab from './view/LinkedItemsTab';
import TaskLogTab from './view/TaskLogTab';
import CommentHistoryTab from './view/CommentHistoryTab';
import CaseDetailsTab from './view/CaseDetailsTab';

type ViewTabKey = 'details' | 'evidence' | 'linked' | 'tasks' | 'comments';

interface ViewCaseModalProps {
  open: boolean;
  onClose: () => void;
  row?: CaseRow | null;
  onRefreshCases?: () => Promise<void>;
  canManageSupervisorActions?: boolean;
  onComplete?: (row: CaseRow) => void;
  onCloseCase?: (row: CaseRow) => void;
  onReopenCase?: (row: CaseRow) => void;
  onAbandonCase?: (row: CaseRow) => void;
  onSuspendCase?: (row: CaseRow) => void;
  onResumeCase?: (row: CaseRow) => void;
  onApproveCase?: (row: CaseRow) => void;
  onApproveCaseReopen?: (row: CaseRow) => void;
  onRejectCaseReopen?: (row: CaseRow) => void;
  onApproveCaseCreation?: (row: CaseRow) => void;
  onRejectCaseCreation?: (row: CaseRow) => void;
}

const ViewCaseModal: React.FC<ViewCaseModalProps> = ({ 
  open, 
  onClose, 
  row, 
  onRefreshCases,
  canManageSupervisorActions = false,
  onComplete,
  onCloseCase,
  onReopenCase,
  onAbandonCase,
  onSuspendCase,
  onResumeCase,
  onApproveCase,
  onApproveCaseReopen,
  onRejectCaseReopen,
  onApproveCaseCreation,
  onRejectCaseCreation
}) => {
  const [tab, setTab] = React.useState<ViewTabKey>('details');
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
        { }
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{showCollaborate ? 'Case Collaboration' : 'Case Details'}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        { }
        {!showCollaborate && (
          <div className="flex items-center gap-2 px-6 pt-3">
            {(
              [
                { key: 'details', label: 'Case Details' },
                { key: 'evidence', label: 'Evidence & Documents' },
                { key: 'linked', label: 'Linked Items' },
                { key: 'tasks', label: 'Task Log' },
                { key: 'comments', label: 'Comments History' },
              ] satisfies Array<{ key: ViewTabKey; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px rounded-t-md px-3 py-2 text-sm font-medium ${tab === t.key ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        { }
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {showCollaborate ? (
            <CollaboratePanel />
          ) : (
            <>
              {tab === 'details' && (
                <CaseDetailsTab 
                  row={row} 
                  canManageSupervisorActions={canManageSupervisorActions}
                  onComplete={onComplete}
                  onCloseCase={onCloseCase}
                  onReopenCase={onReopenCase}
                  onAbandonCase={onAbandonCase}
                  onSuspendCase={onSuspendCase}
                  onResumeCase={onResumeCase}
                  onApproveCase={onApproveCase}
                  onApproveCaseReopen={onApproveCaseReopen}
                  onRejectCaseReopen={onRejectCaseReopen}
                  onApproveCaseCreation={onApproveCaseCreation}
                  onRejectCaseCreation={onRejectCaseCreation}
                />
              )}
              {tab === 'evidence' && <EvidenceDocumentsTab />}
              {tab === 'linked' && <LinkedItemsTab />}
              {tab === 'tasks' && (
                <TaskLogTab 
                  caseId={row.id} 
                  alertId={row.alertId} 
                  onRefreshCases={onRefreshCases}
                  canManageSupervisorActions={canManageSupervisorActions}
                  caseData={row}
                  onApproveCase={onApproveCase}
                  onApproveCaseCreation={onApproveCaseCreation}
                  onRejectCaseCreation={onRejectCaseCreation}
                  onAbandonCase={onAbandonCase}
                />
              )}
              {/* {tab === 'notes' && <InvestigationNotesTab />} */}
              {tab === 'comments' && <CommentHistoryTab caseId={row.id} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewCaseModal;
