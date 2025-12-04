import React, { useState, useEffect } from 'react';
import { useToast } from '@/shared/providers/ToastProvider';
import workQueueService from '../../services/workQueueService';

interface CreateQueueModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: () => void;
}

const CreateQueueModal: React.FC<CreateQueueModalProps> = ({ 
  open, 
  onClose, 
  onCreate 
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { success, error } = useToast();
  const type = 'candidate'; 

  // Reset form when modal opens/close
  useEffect(() => {
    if (!open) {
      setId('');
      setName('');
    }
  }, [open]);

  if (!open) return null;

  const canConfirm = Boolean(id.trim() && name.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm || isLoading) return;

    setIsLoading(true);
    
    try {
        await workQueueService.createCandidateGroup({
        groupId: id.trim(),
        groupName: name.trim(),
        groupType: type
      });

      success('Queue Created', 'Candidate group created successfully');
      onClose();
      if (onCreate) {
        onCreate(); // Refresh data if callback provided
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      error('Creation Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Work Queue</h3>
          <p className="mt-1 text-sm text-gray-600">
            Create a new work queue to organize tasks for specific user groups.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Queue ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter a unique queue identifier"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <div className="mt-1 text-xs text-gray-500">
              Use a unique identifier for this queue (e.g., "fraud-team", "aml-analysts")
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Queue Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a descriptive name for the queue"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <div className="mt-1 text-xs text-gray-500">
              A human-readable name for the work queue
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-gray-200">
                {type}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Queue type is automatically set to "candidate"
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <button 
              type="button"
              onClick={onClose} 
              className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm || isLoading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQueueModal;