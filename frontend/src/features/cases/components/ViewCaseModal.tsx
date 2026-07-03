import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
// import CollaborateButton from './view/CollaborateButton';
import CollaboratePanel from './view/CollaboratePanel';
import TaskLogTab from './view/TaskLogTab';
import CommentHistoryTab from './view/CommentHistoryTab';
import CaseDetailsTab from './view/CaseDetailsTab';
import CaseHistoryTab from './view/CaseHistoryTab';
import CaseActionsPanel from './view/CaseActionsPanel';
import { caseService, type CaseWithTasksDto } from '../services/caseService';
import { transformBackendCaseToUI } from './casesTable.utils';
import LinkedItemsTab from './view/LinkedItemsTab';

type ViewTabKey = 'details' | 'tasks' | 'linked' | 'history' | 'comments';

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
  onAfterTaskReassign?: () => void;
  generateReport?: (caseId: number) => void;
  setSubCasesDetails?: (rows: CaseRow[]) => void;
}

const ViewCaseModal: React.FC<ViewCaseModalProps> = ({
  open,
  onClose,
  row,
  onRefreshCases,
  onAfterTaskReassign,
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
  onRejectCaseCreation,
  setSubCasesDetails,
}) => {
  const [tab, setTab] = React.useState<ViewTabKey>('details');
  const [showCollaborate, setShowCollaborate] = React.useState(false);
  const [localCaseData, setLocalCaseData] = React.useState<CaseRow | null>(
    null,
  );
  const [subCases, setSubCases] = React.useState<CaseRow[]>([]);
  const [parentCase, setparentCase] = React.useState<CaseRow | null>(null);

  // Initialize local case data when row changes
  React.useEffect(() => {
    setLocalCaseData(null); // Clear previous data while loading new data
    if (row) {
      setLocalCaseData(row);
    }
  }, [row]);

  React.useEffect(() => {
    if (open) {
      setTab('details');
      setShowCollaborate(false);
    }
  }, [open]);

  // Function to refresh case data
  const refreshCaseData = React.useCallback(async () => {
    if (!row?.id) return;
    try {
      const caseDetails = await caseService.getCaseDetails(row.id);
      const transformedCase = transformBackendCaseToUI(
        caseDetails as unknown as CaseWithTasksDto,
      );
      setLocalCaseData(transformedCase);
    } catch (error) {
      console.error('Failed to refresh case data:', error);
    }
  }, [row?.id]);

  const getParentCaseData = React.useCallback(async () => {
    if (!row?.id || !row?.parentId) return;
    try {
      const caseDetails = await caseService.getCaseDetails(row.parentId);
      const transformedCase = transformBackendCaseToUI(
        caseDetails as unknown as CaseWithTasksDto,
      );
      setparentCase(transformedCase);
    } catch (error) {
      console.error('Failed to refresh case data:', error);
    }
  }, [row?.id, row?.parentId]);

  const getSubCasesData = React.useCallback(async () => {
    if (!localCaseData?.type || !localCaseData?.id) return;

    if (localCaseData.type === 'FRAUD_AND_AML') {
      try {
        const subCasesDetails = await caseService.getSubCasesDetails(
          localCaseData.id,
        );
        const transformed = subCasesDetails.map((c) =>
          transformBackendCaseToUI(c as unknown as CaseWithTasksDto),
        );

        setSubCases(transformed);
        setSubCasesDetails?.(transformed);
      } catch (error) {
        console.error('Failed to fetch subCases data:', error);
      }
    } else {
      setSubCases([]);
      setSubCasesDetails?.([]);
    }
  }, [localCaseData?.type, localCaseData?.id]);

  React.useEffect(() => {
    if (open && localCaseData) {
      getSubCasesData();
      getParentCaseData();
    }
  }, [open, localCaseData, getSubCasesData, getParentCaseData]);

  if (!open || !localCaseData) return null;

  const displayData = localCaseData;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-5xl rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        { }
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {showCollaborate ? 'Case Collaboration' : 'Case Details'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        { }
        {!showCollaborate && (
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-gray-200">
            {(
              [
                { key: 'details', label: 'Case Details' },
                { key: 'tasks', label: 'Task Log' },
                { key: 'linked', label: 'Linked Items' },
                { key: 'history', label: 'Case History' },
                { key: 'comments', label: 'Comments History' },
              ] satisfies Array<{ key: ViewTabKey; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                }}
                className={`-mb-px rounded-t-md px-3 py-2 text-sm font-medium ${tab === t.key
                  ? 'border-b-2 border-indigo-600 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-800'
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
                  row={displayData}
                  subCasesDetails={
                    displayData.type === 'FRAUD_AND_AML' ? subCases : undefined
                  }
                  parentCaseDetails={displayData?.parentId ? parentCase : null}
                  canManageSupervisorActions={canManageSupervisorActions}
                  showActions={false}
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
              {tab === 'tasks' && (
                <TaskLogTab
                  caseId={displayData.id}
                  alertId={displayData.alertId}
                  onAfterTaskReassign={onAfterTaskReassign}
                  onRefreshCases={async () => {
                    // Refresh both the main case list and the local case data
                    await Promise.all([onRefreshCases?.(), refreshCaseData()]);
                  }}
                  canManageSupervisorActions={canManageSupervisorActions}
                  caseData={displayData}
                  caseStatus={displayData.status}
                  onApproveCase={onApproveCase}
                  onApproveCaseCreation={onApproveCaseCreation}
                  onRejectCaseCreation={onRejectCaseCreation}
                  onAbandonCase={onAbandonCase}
                  onSwitchToCaseDetails={() => { setTab('details'); }}
                />
              )}

              {tab === 'linked' && (
                <LinkedItemsTab
                  caseId={displayData.id}
                />
              )}
              {tab === 'comments' && (
                <CommentHistoryTab caseId={displayData.id} />
              )}
              {tab === 'history' && (
                <CaseHistoryTab caseId={displayData.id} row={displayData} />
              )}
            </>
          )}
        </div>

        { }
        {!showCollaborate && tab === 'details' && (
          <div className="border-t border-gray-200 bg-white px-6 py-4">
            <CaseActionsPanel
              caseData={displayData}
              subCasesDetails={
                displayData.type === 'FRAUD_AND_AML' ? subCases : undefined
              }
              parentCaseDetails={displayData?.parentId ? parentCase : null}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewCaseModal;
