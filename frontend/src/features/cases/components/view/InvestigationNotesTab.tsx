import React from 'react';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  NumberedListIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { commentService, type Comment } from '../../services/commentService';

interface InvestigationNotesTabProps {
  taskId?: string;
}

const InvestigationNotesTab: React.FC<InvestigationNotesTabProps> = ({ 
  taskId,
}) => {
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [existingComments, setExistingComments] = React.useState<Comment[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Load existing comments when component mounts
  React.useEffect(() => {
    const loadComments = async () => {
      if (!taskId) return;
      
      setLoading(true);
      try {
        const comments = await commentService.getCommentsByTask(taskId);
        setExistingComments(comments);
        // Combine all notes (most recent first)
        if (comments.length > 0) {
          const combinedNotes = comments.map(c => c.note).join('\n\n---\n\n');
          setNotes(combinedNotes);
        }
      } catch (error) {
        console.error('Failed to load investigation notes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [taskId]);

  const insertFormatting = (
    prefix: string,
    suffix: string = '',
    placeholder: string = ''
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = notes.substring(start, end);
    const textToInsert = selectedText || placeholder;

    const newText =
      notes.substring(0, start) +
      prefix +
      textToInsert +
      suffix +
      notes.substring(end);

    setNotes(newText);

    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + prefix.length + textToInsert.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleBold = () => insertFormatting('**', '**', ' ');
  const handleItalic = () => insertFormatting('_', '_', ' ');
  const handleUnderline = () => insertFormatting('<u>', '</u>', ' ');
  const handleBulletList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = notes.lastIndexOf('\n', start - 1) + 1;
    const newText =
      notes.substring(0, lineStart) + '• ' + notes.substring(lineStart);
    setNotes(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  const handleNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = notes.lastIndexOf('\n', start - 1) + 1;
    const newText =
      notes.substring(0, lineStart) + '1. ' + notes.substring(lineStart);
    setNotes(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 3, start + 3);
    }, 0);
  };

  const handleLink = () => insertFormatting('[', '](url)', 'link text');

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

          {/* Editor Container */}
          <div className="overflow-hidden rounded-md border border-gray-300 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 border-b border-gray-300 bg-gray-50 p-2">
              <button
                type="button"
                onClick={handleBold}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                title="Bold (Markdown: **text**)"
              >
                <BoldIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleItalic}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                title="Italic (Markdown: _text_)"
              >
                <ItalicIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleUnderline}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                title="Underline (HTML: <u>text</u>)"
              >
                <UnderlineIcon className="h-5 w-5" />
              </button>
              <div className="mx-1 h-6 w-px bg-gray-300"></div>
              <button
                type="button"
                onClick={handleBulletList}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                title="Bullet List"
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleNumberedList}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                title="Numbered List"
              >
                <NumberedListIcon className="h-5 w-5" />
              </button>
              <div className="mx-1 h-6 w-px bg-gray-300"></div>
              <button
                type="button"
                onClick={handleLink}
                className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                title="Insert Link (Markdown: [text](url))"
              >
                <LinkIcon className="h-5 w-5" />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your investigation notes here... (supports Markdown formatting)"
              rows={12}
              className="w-full resize-none border-0 px-3 py-2 text-sm focus:outline-none focus:ring-0"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default InvestigationNotesTab;
