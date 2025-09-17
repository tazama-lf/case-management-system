import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface CreateCaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    caseType: string;
    source: string;
    typologies: string[];
    description?: string;
    assignee?: string;
    attachments?: File[];
    comments?: string;
    linkToExistingCaseId?: string;
    draft?: boolean;
  }) => void;
  initial?: {
    caseId?: string;
    caseType?: string;
    source?: string;
    typologies?: string[];
    description?: string;
    assignee?: string;
    comments?: string;
    linkToExistingCaseId?: string;
  };
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ open, onClose, onCreate, initial }) => {
  const [caseId, setCaseId] = React.useState('');
  const [caseType, setCaseType] = React.useState('');
  const [source, setSource] = React.useState('');
  const [typologyInput, setTypologyInput] = React.useState('');
  const [typologies, setTypologies] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [assignee, setAssignee] = React.useState('');
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [comments, setComments] = React.useState('');
  const [linkToExistingCaseId, setLinkToExistingCaseId] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    // Prefill with provided initial values or reset to defaults when opened
    setCaseId(initial?.caseId || '');
    setCaseType(initial?.caseType || '');
    setSource(initial?.source || '');
    setTypologyInput('');
    setTypologies(initial?.typologies || []);
    setDescription(initial?.description || '');
    setAssignee(initial?.assignee || 'Assign Automatically');
    setAttachments([]);
    setComments(initial?.comments || '');
    setLinkToExistingCaseId(initial?.linkToExistingCaseId || '');
  }, [open, initial]);

  if (!open) return null;

  const addTypology = () => {
    const v = typologyInput.trim();
    if (!v) return;
    setTypologies((prev) => Array.from(new Set([...prev, v])));
    setTypologyInput('');
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setAttachments((prev) => [...prev, ...files]);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const canCreate = Boolean(caseType && source);

  const submit = (draft = false) => {
    onCreate({
      caseType,
      source,
      typologies,
      description: description || undefined,
      assignee: assignee === 'Assign Automatically' ? undefined : assignee,
      attachments,
      comments: comments || undefined,
      linkToExistingCaseId: linkToExistingCaseId || undefined,
      draft,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Case</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            {/* Case ID (auto-generated, not editable) */}
            {caseId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Case ID (auto-generated)</label>
                <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {caseId}
                </div>
              </div>
            )}

            {/* Case Type and Source */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Case Type *</label>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select Case Type</option>
                  <option>Fraud</option>
                  <option>Money Laundering</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Source *</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select Source</option>
                  <option>Customer Complaint</option>
                  <option>Internal Review</option>
                </select>
              </div>
            </div>

            {/* Typology */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Typology</label>
              <div className="flex gap-2">
                <input
                  value={typologyInput}
                  onChange={(e) => setTypologyInput(e.target.value)}
                  placeholder="Add Typology"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button type="button" onClick={addTypology} className="rounded-md border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">
                  Add
                </button>
              </div>
              {typologies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {typologies.map((t) => (
                    <span key={t} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Assign To */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assign To</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option>Assign Automatically</option>
                <option>John Smith</option>
                <option>Sarah Johnson</option>
                <option>Michael Brown</option>
              </select>
            </div>

            {/* Attachments */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Attachments</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-600"
              >
                <label className="cursor-pointer rounded-md border bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">
                  <input type="file" multiple className="hidden" onChange={onPickFiles} />
                  Upload Files
                </label>
                <div className="mt-2 text-xs text-gray-400">or drag and drop files here</div>
              </div>
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {attachments.map((f, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span>{f.name}</span>
                      <button type="button" onClick={() => removeAttachment(idx)} className="text-xs text-red-600 hover:underline">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Comments</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Link to Existing Case */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Link to Existing Case</label>
              <input
                value={linkToExistingCaseId}
                onChange={(e) => setLinkToExistingCaseId(e.target.value)}
                placeholder="Enter Case ID"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => submit(true)} className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Save as Draft</button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={!canCreate}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Create Case
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCaseModal;
