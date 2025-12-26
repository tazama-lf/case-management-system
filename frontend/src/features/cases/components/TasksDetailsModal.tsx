import React from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
import CollaboratePanel from './view/CollaboratePanel';
import TaskEvidenceTab from './view/TaskEvidenceTab';
import LinkedItemsTab from './view/LinkedItemsTab';
import InvestigationNotesTab from './view/InvestigationNotesTab';
import InvestigationSummaryTab from './view/InvestigationsSummaryTab';
import TaskDetailsTab from './view/TaskDetailsTab';
import { taskService, type TaskForSupervisor } from '../services/taskService';

type ViewTabKey = 'details' | 'evidence' | 'linked' | 'tasks' | 'notes' | 'customer' | 'summary';

interface TaskDetailsModalProps {
  selectedTask: any;
  open: boolean;
  onClose: () => void;
  row?: CaseRow | null;
  onRefreshCases?: () => Promise<void>;
  onTaskUpdate?: () => void;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  selectedTask,
  open,
  onClose,
  row,
  onRefreshCases: _onRefreshCases,
  onTaskUpdate,
}) => {
  const [tab, setTab] = React.useState<ViewTabKey>('details');
  const [showCollaborate, setShowCollaborate] = React.useState(false);
  const [tasks, setTasks] = React.useState<TaskForSupervisor[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const uploadEvidenceRef = React.useRef<(() => Promise<void>) | null>(null);
  const [summaryRefreshKey, setSummaryRefreshKey] = React.useState(0);

  // Extract transaction ID from transaction data
  // const transactionId = React.useMemo(() => {

  //   if (!row?.transaction) {
  //     return undefined;
  //   }

  //   let transactionData = row.transaction;

  //   // Check if transaction is a string that needs parsing
  //   if (typeof transactionData === 'string') {
  //     try {
  //       transactionData = JSON.parse(transactionData);
  //     } catch (e) {
  //       return undefined;
  //     }
  //   }

  //   const transaction = transactionData as Record<string, unknown>;

  //   const fiToFIPmtSts = transaction?.FIToFIPmtSts as Record<string, unknown> | undefined;
  //   const txInfAndSts = fiToFIPmtSts?.TxInfAndSts as Record<string, unknown> | undefined;


  //   // Try multiple possible field locations
  //   const extractedId = (
  //     txInfAndSts?.OrgnlEndToEndId ||
  //     txInfAndSts?.EndToEndId ||
  //     transaction?.transaction_id ||
  //     transaction?.transactionId
  //   );

  //   if (extractedId && typeof extractedId === 'string') {
  //     return extractedId;
  //   }

  //   return undefined;
  // }, [row]);

  React.useEffect(() => {
    if (open) {
      setTab('details');
      setShowCollaborate(false);
      setSaveSuccess(false);
      uploadEvidenceRef.current = null;
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

  const handleSaveTask = async () => {
    if (!tasks[0]?.task_id) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {

      if (uploadEvidenceRef.current) {
        await uploadEvidenceRef.current();
        setSaveSuccess(true);


        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (error) {
      alert('Failed to upload evidence. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  

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
                { key: 'notes', label: 'Investigation Notes' },
                { key: 'summary', label: 'Investigation Summary' },
              ] satisfies Array<{ key: ViewTabKey; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
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
                <TaskDetailsTab row={row} tasks={tasks.filter(t => t.task_id === selectedTask?.id)} loadingTasks={loadingTasks} />
              </div>
              <div style={{ display: tab === 'evidence' ? 'block' : 'none' }}>
                <TaskEvidenceTab
                  taskId={tasks.filter(t => t.task_id === selectedTask?.id)[0]?.task_id}
                  onSaveRequest={(uploadFn) => {
                    uploadEvidenceRef.current = uploadFn;
                  }}
                  onUploadComplete={() => {

                  }}
                />
              </div>
              <div style={{ display: tab === 'linked' ? 'block' : 'none' }}>
                {row?.id && <LinkedItemsTab caseId={row.id} />}
              </div>
              <div style={{ display: tab === 'notes' ? 'block' : 'none' }}>
                <InvestigationNotesTab
                  task={tasks.filter(t => t.task_id === selectedTask?.id)[0]}
                  onNotesUpdate={() => setSummaryRefreshKey(prev => prev + 1)}
                />
              </div>
              <div style={{ display: tab === 'summary' ? 'block' : 'none' }}>
                {row?.id && (
                  <InvestigationSummaryTab
                    caseId={row.id}
                    row={row}
                    refreshKey={summaryRefreshKey}
                    onTaskUpdate={() => {
                      // Refresh tasks in this modal
                      if (row?.id) {
                        taskService.getTasksByCaseId(row.id).then(setTasks).catch(console.error);
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
          {saveSuccess && (
            <span className="text-sm text-green-600 font-medium">
              ✓ Evidence uploaded successfully
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-1 focus:ring-gray-400"
            disabled={saving}
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            Close
          </button>
          {tab === 'evidence' && (
            <button
              type="button"
              onClick={handleSaveTask}
              disabled={saving || !tasks[0]?.task_id || uploadEvidenceRef.current === null}
              className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-1 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Uploading...' : 'Upload Evidence'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
