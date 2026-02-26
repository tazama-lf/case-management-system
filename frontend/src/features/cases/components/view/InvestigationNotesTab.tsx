import React from 'react';
import 'easymde/dist/easymde.min.css';
import { CheckIcon } from '@heroicons/react/24/outline';
import {
  taskService,
  type TaskForSupervisor,
} from '../../services/taskService';
import { useNotifications } from '@/shared/providers/NotificationProvider';
import {
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  toolbarPlugin,
  BlockTypeSelect,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { TaskStatus } from '../../services/taskService';
import { authService } from '@/features/auth';
interface InvestigationNotesTabProps {
  task?: TaskForSupervisor;
  onNotesUpdate?: () => void;
}

const InvestigationNotesTab: React.FC<InvestigationNotesTabProps> = ({
  task,
  onNotesUpdate,
}) => {
  const CHAR_LIMIT = 32000;
  const getCharCount = (text: string) => text.length;

  const { showSuccess, showError } = useNotifications();
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const isTaskCompleted = task?.status === TaskStatus.STATUS_30_COMPLETED;

  React.useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && target.closest('.mdx-editor-container')) {
        e.preventDefault();
        const { href } = target as HTMLAnchorElement;
        let url = href;
        if (!/^https?:\/\//iu.exec(href) && !/^mailto:/iu.exec(href)) {
          const match = /\/([^/]+)$/u.exec(href);
          if (match) {
            url = `https://${match[1]}`;
          }
        }

        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, []);

  const transformMarkdownLinks = (markdown: string): string =>
    markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (match, text, url) => {
      if (!url.match(/^(https?:\/\/|mailto:|#)/iu)) {
        return `[${text}](https://${url})`;
      }
      return match;
    });

  const handleNotesChange = (value: string) => {
    const transformedValue = transformMarkdownLinks(value);
    setNotes(transformedValue);
  };

  const isUserAbleToSaveNotes = () => {
    const user = authService.getUser();
    return user?.userId === task?.assigned_user_id;
  };

  const isUserCanEdit = isUserAbleToSaveNotes() && !isTaskCompleted;

  const handleSaveNotes = async () => {
    if (!task?.task_id || !notes.trim()) {
      showError('Please add investigation notes before saving.');
      return;
    }

    const charCount = getCharCount(notes);
    if (charCount > CHAR_LIMIT) {
      showError(`Character limit exceeded (${CHAR_LIMIT} max).`);
      return;
    }

    setSaving(true);
    try {
      await taskService.updateTaskForSupervisor(task.task_id, {
        investigationNotes: notes,
      });
      showSuccess('Investigation notes saved successfully!');

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
          {/* MDX Editor */}
          <div className="mdx-editor-container min-h-[250px]">
            <MDXEditor
              markdown={notes}
              onChange={handleNotesChange}
              readOnly={
                !isUserCanEdit ||
                saving ||
                isTaskCompleted ||
                task?.status === 'STATUS_21_BLOCKED'
              }
              className="mdx-editor"
              contentEditableClassName="prose"
              plugins={[
                headingsPlugin(),
                listsPlugin(),
                linkDialogPlugin(),
                linkPlugin(),
                quotePlugin(),
                markdownShortcutPlugin(),
                toolbarPlugin({
                  toolbarClassName: 'editor-toolbar ',
                  toolbarContents: () => (
                    <>
                      <UndoRedo />
                      <BoldItalicUnderlineToggles />
                      <ListsToggle />
                      <CreateLink />
                    </>
                  ),
                }),
              ]}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-between text-sm mt-1">
            <span
              className={
                getCharCount(notes) >= CHAR_LIMIT
                  ? 'text-red-600 font-medium'
                  : 'text-gray-500'
              }
            >
              Character count: {getCharCount(notes)} / {CHAR_LIMIT}
            </span>
          </div>
          {isUserAbleToSaveNotes() && (
            <div className="flex justify-end gap-2">
              <button
                onClick={handleSaveNotes}
                disabled={
                  saving ||
                  !notes.trim() ||
                  isTaskCompleted ||
                  task?.status === 'STATUS_21_BLOCKED' ||
                  getCharCount(notes) >= CHAR_LIMIT
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-md hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                <CheckIcon className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Investigation Notes'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InvestigationNotesTab;
