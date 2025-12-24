import React from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { marked } from 'marked';
import {
  CheckIcon,
} from '@heroicons/react/24/outline';
import { commentService, type TaskComment } from '../../services/commentService';
import { taskService, type TaskForSupervisor } from '../../services/taskService';
import { useNotifications } from '@/shared/providers/NotificationProvider';

interface InvestigationNotesTabProps {
  task?: TaskForSupervisor;
  onNotesUpdate?: () => void;
}

const InvestigationNotesTab: React.FC<InvestigationNotesTabProps> = ({
  task,
  onNotesUpdate,
}) => {
  const { showSuccess, showError } = useNotifications();
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [existingComments, setExistingComments] = React.useState<TaskComment[]>([]);

  const simpleMDEOptions = React.useMemo(() => ({
    spellChecker: false,
    placeholder: "Add your investigation notes here...",
    status: false,
    autofocus: false,
    tabSize: 2,
    previewRender: function(plainText: string) {
      return marked.parse(plainText);
    },
    toolbar: [
      "bold", "italic",
      {
        name: "underline",
        action: function customFunction(editor: any) {
          const cm = editor.codemirror;
          const selection = cm.getSelection();
          cm.replaceSelection(`<u>${selection}</u>`);
        },
        className: "fa fa-underline",
        title: "Underline",
      },
      "|",
      "unordered-list", "ordered-list", "|",
      "link"
    ],
  } as any), []);

  React.useEffect(() => {
    const loadComments = async () => {
      if (!task) return;
      setNotes(task.investigationNotes || '');
      setLoading(true);
      try {
        const comments = await commentService.getCommentsByTask(task.task_id);
        setExistingComments(comments);
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [task]);

  const handleSaveNotes = async () => {
    if (!task?.task_id || !notes.trim()) {
      showError('Please add investigation notes before saving.');
      return;
    }

    setSaving(true);
    try {
      await taskService.updateTaskForSupervisor(task.task_id, {
        investigationNotes: notes,
      });
      showSuccess('Investigation notes saved successfully!');
      
      // Trigger refresh in investigation summary
      if (onNotesUpdate) {
        onNotesUpdate();
      }
    } catch (error) {
      console.error('Failed to save investigation notes:', error);
      showError('Failed to save investigation notes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold text-gray-700">
        Investigation Notes
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-gray-500">Loading notes...</div>
        </div>
      ) : (
        <>
          {/* Show existing comments as read-only */}
          {existingComments.length > 0 && (
            <div className="space-y-3 mb-4">
              <div className="text-xs font-semibold text-gray-500 uppercase">
                Previous Notes ({existingComments.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border border-gray-200 p-3 bg-gray-50">
                {existingComments.map((comment) => (
                  <div key={comment.comment_id} className="text-sm text-gray-700 pb-2 border-b border-gray-200 last:border-0">
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(comment.created_at).toLocaleString()}
                    </div>
                    <div className="whitespace-pre-wrap">{comment.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SimpleMDE Editor */}
          <div className="simplemde-wrapper">
            <SimpleMDE
              value={notes}
              onChange={setNotes}
              options={simpleMDEOptions}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSaveNotes}
              disabled={saving || !notes.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-md hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              <CheckIcon className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Investigation Notes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InvestigationNotesTab;
