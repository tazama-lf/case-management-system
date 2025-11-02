import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type Collaborator = {
  id: string;
  name: string;
  role: string;
};

export interface NewDiscussionThreadPayload {
  title: string;
  message: string;
  collaboratorIds: string[];
}

interface NewDiscussionThreadModalProps {
  open: boolean;
  onClose: () => void;
  collaborators: Collaborator[];
  onCreate: (payload: NewDiscussionThreadPayload) => void;
}

const NewDiscussionThreadModal: React.FC<NewDiscussionThreadModalProps> = ({ open, onClose, collaborators, onCreate }) => {
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!open) {
      setTitle('');
      setMessage('');
      setSelected({});
    }
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const canCreate = title.trim().length > 0 && message.trim().length > 0;

  const submit = () => {
    if (!canCreate) return;
    const collaboratorIds = Object.keys(selected).filter((id) => selected[id]);
    onCreate({ title: title.trim(), message: message.trim(), collaboratorIds });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        {}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Discussion Thread</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Thread Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a descriptive title"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Initial Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Start the discussion..."
                rows={5}
                className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">Add Collaborators</div>
              <div className="space-y-2">
                {collaborators.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={!!selected[c.id]}
                      onChange={() => toggle(c.id)}
                    />
                    <div>
                      <div className="text-sm text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.role}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <button onClick={onClose} className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={submit}
            disabled={!canCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            Create Thread
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewDiscussionThreadModal;
