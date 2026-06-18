import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
import CollaboratePanel from './view/CollaboratePanel';
import TaskEvidenceTab from './view/TaskEvidenceTab';
import LinkedItemsTab from './view/LinkedItemsTab';
import InvestigationNotesTab from './view/InvestigationNotesTab';
import InvestigationSummaryTab from './view/InvestigationsSummaryTab';
import TaskDetailsTab from './view/TaskDetailsTab';
import VisualizationsTab from './view/VisualizationsTab';
import { taskService, type TaskForSupervisor } from '../services/taskService';
import { caseService } from '../services/caseService';
import type { Case } from '@/features/alerts/types/triage.types';

type ViewTabKey =
  | 'details'
  | 'evidence'
  | 'visualizations'
  | 'linked'
  | 'tasks'
  | 'notes'
  | 'customer'
  | 'summary';

interface TaskDetailsModalProps {
  selectedTask: any;
  open: boolean;
  onClose: () => void;
  row?: CaseRow | null;
  onRefreshCases?: () => Promise<void>;
  onTaskUpdate?: () => void;
  onSwitchToCaseDetails?: () => void;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  selectedTask,
  open,
  onClose,
  row,
  onRefreshCases: _onRefreshCases,
  onTaskUpdate,
  onSwitchToCaseDetails,
}) => {
  const [tab, setTab] = React.useState<ViewTabKey>('details');
  const [showCollaborate, setShowCollaborate] = React.useState(false);
  const [tasks, setTasks] = React.useState<TaskForSupervisor[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);
  const [parentAlertId, setParentAlertId] = React.useState<number | undefined>(
    undefined,
  );
  const [parentCaseDetails, setParentCaseDetails] = React.useState<
    Case | undefined
  >(undefined);
  const [isParentCaseLoading, setIsParentCaseLoading] = React.useState(false);

  const [summaryRefreshKey, setSummaryRefreshKey] = React.useState(0);
  const initialCaseIdRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (row?.parentId) {
      setIsParentCaseLoading(true);
      caseService
        .getCaseDetails(row.parentId)
        .then((details) => {
          setParentAlertId(details.alert.alert_id);
          setParentCaseDetails(details);
        })
        .catch((error) => {
          console.error('Failed to fetch case details for parent case:', error);
          setParentAlertId(undefined);
          setParentCaseDetails(undefined);
        })
        .finally(() => {
          setIsParentCaseLoading(false);
        });
    } else {
      setParentAlertId(undefined);
      setParentCaseDetails(undefined);
      setIsParentCaseLoading(false);
    }
  }, [row?.parentId]);

  React.useEffect(() => {
    if (open) {
      setTab('details');
      setShowCollaborate(false);
      // setSaveSuccess(false);
      window.scrollTo({ top: 0 });

      // Fetch tasks for this case
      if (row?.id) {
        setLoadingTasks(true);
        taskService
          .getTasksByCaseId(row.id)
          .then((fetchedTasks) => {
            setTasks(fetchedTasks);
          })
          .catch((error) => {
            console.error('Failed to fetch tasks:', error);
          })
          .finally(() => {
            setLoadingTasks(false);
          });
      }
    }
  }, [open, row?.id]);

  // Close modal when navigating to a different case
  React.useEffect(() => {
    if (
      open &&
      initialCaseIdRef.current &&
      row?.id !== initialCaseIdRef.current
    ) {
      onClose();
    }


    if (open) {
      initialCaseIdRef.current = row?.id;
    }
  }, [row?.id, open, onClose]);

  //Extract transaction ID from transaction data
  const transactionId = React.useMemo(() => {
    if (row?.parentId && isParentCaseLoading) {
      // Wait for parent details before deciding visibility to avoid tab flicker.
      return undefined;
    }

    let transactionData = row?.parentId
      ? parentCaseDetails?.alert.transaction
      : row?.transaction;

    if (!transactionData) {
      return undefined;
    }

    // Check if transaction is a string that needs parsing
    if (typeof transactionData === 'string') {
      try {
        transactionData = JSON.parse(transactionData);
      } catch (e) {
        return undefined;
      }
    }

    const transaction = transactionData as Record<string, unknown>;
    setShouldShowVisualizations(transaction?.FIToFIPmtSts !== undefined);

    const fiToFIPmtSts = transaction?.FIToFIPmtSts as
      | Record<string, unknown>
      | undefined;
    const txInfAndSts = fiToFIPmtSts?.TxInfAndSts as
      | Record<string, unknown>
      | undefined;

    // Try multiple possible field locations
    const extractedId =
      txInfAndSts?.OrgnlEndToEndId ||
      txInfAndSts?.EndToEndId ||
      transaction?.transaction_id ||
      transaction?.transactionId;

    if (extractedId && typeof extractedId === 'string') {
      return extractedId;
    }

    return undefined;
  }, [row, parentCaseDetails, isParentCaseLoading]);

  const shouldShowVisualizations = React.useMemo(() => {
    if (row?.parentId && isParentCaseLoading) {
      return false;
    }

    let transactionData = row?.parentId
      ? parentCaseDetails?.alert.transaction
      : row?.transaction;

    if (!transactionData) {
      return false;
    }

    if (typeof transactionData === 'string') {
      try {
        transactionData = JSON.parse(transactionData);
      } catch (e) {
        return false;
      }
    }

    const transaction = transactionData as Record<string, unknown>;
    return transaction?.FIToFIPmtSts !== undefined;
  }, [row, parentCaseDetails, isParentCaseLoading]);

  React.useEffect(() => {
    if (shouldShowVisualizations === false && tab === 'visualizations') {
      setTab('details');
    }
  }, [shouldShowVisualizations, tab]);

  React.useEffect(() => {
    if (shouldShowVisualizations === false && tab === 'visualizations') {
      setTab('details');
    }
  }, [shouldShowVisualizations, tab]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-6 w-full max-w-5xl rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        { }
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {showCollaborate ? 'Case Collaboration' : 'Task Details'}
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
          <div className="flex items-center gap-2 px-6 pt-3">
            {(
              [
                { key: 'details', label: 'Task Details' },
                { key: 'linked', label: 'Linked Items' },
                { key: 'evidence', label: 'Evidence' },
                ...(shouldShowVisualizations === true
                  ? ([
                      {
                        key: 'visualizations',
                        label: 'Visualizations',
                      },
                    ] as const)
                  : []),
                { key: 'notes', label: 'Investigation Notes' },
                { key: 'summary', label: 'Investigation Summary' },
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
        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {showCollaborate ? (
            <CollaboratePanel />
          ) : (
            <>
              <div style={{ display: tab === 'details' ? 'block' : 'none' }}>
                <TaskDetailsTab
                  row={row}
                  tasks={tasks.filter((t) => t.task_id === selectedTask?.id)}
                  loadingTasks={loadingTasks}
                />
              </div>
              <div style={{ display: tab === 'evidence' ? 'block' : 'none' }}>
                <TaskEvidenceTab
                  task={tasks.filter((t) => t.task_id === selectedTask?.id)[0]}
                  caseId={row.id}
                  // onSaveRequest={(uploadFn) => {
                  //   uploadEvidenceRef.current = uploadFn;
                  // }}
                  onUploadComplete={() => {
                    setSummaryRefreshKey((prev) => prev + 1);
                  }}
                />
              </div>
              {shouldShowVisualizations === true && (
                <div
                  style={{
                    display: tab === 'visualizations' ? 'block' : 'none',
                  }}
                >
                  <VisualizationsTab
                    alertId={row?.parentId ? parentAlertId : row?.alertId}
                    caseId={row?.id}
                    transactionId={transactionId}
                  />
                </div>
              )}
              <div style={{ display: tab === 'linked' ? 'block' : 'none' }}>
                {row?.id && (
                  <LinkedItemsTab
                    caseId={row.id}
                    onNavigateToCase={() => {
                      onClose();
                      onSwitchToCaseDetails?.();
                    }}
                  />
                )}
              </div>
              <div style={{ display: tab === 'notes' ? 'block' : 'none' }}>
                <InvestigationNotesTab
                  task={tasks.filter((t) => t.task_id === selectedTask?.id)[0]}
                  onNotesUpdate={() => {
                    setSummaryRefreshKey((prev) => prev + 1);
                  }}
                />
              </div>
              <div style={{ display: tab === 'summary' ? 'block' : 'none' }}>
                {row?.id && (
                  <InvestigationSummaryTab
                    task={
                      tasks.filter((t) => t.task_id === selectedTask?.id)[0]
                    }
                    caseId={row.id}
                    row={row}
                    refreshKey={summaryRefreshKey}
                    onTaskUpdate={() => {
                      // Refresh tasks in this modal
                      if (row?.id) {
                        taskService
                          .getTasksByCaseId(row.id)
                          .then(setTasks)
                          .catch(console.error);
                      }
                      // Notify parent (TaskLogTab) to refresh its task list
                      if (onTaskUpdate) {
                        onTaskUpdate();
                      }
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>

        { }
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-1 focus:ring-gray-400"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
