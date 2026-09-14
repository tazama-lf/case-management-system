import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ReasonRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  /** Short context line under the title, e.g. the target user's id. */
  subtitle?: string;
  /** Explanatory body text shown above the reason field. */
  description?: string;
  icon: React.ReactNode;
  iconWrapperClassName?: string;
  reasonLabel?: string;
  placeholder?: string;
  confirmLabel: string;
  confirmingLabel: string;
  confirmButtonClassName?: string;
  helperText?: string;
}

const ReasonRequiredModal: React.FC<ReasonRequiredModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  icon,
  iconWrapperClassName = 'bg-orange-100',
  reasonLabel = 'Reason',
  placeholder = 'Explain why this action is being taken.',
  confirmLabel,
  confirmingLabel,
  confirmButtonClassName = 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
  helperText = 'A reason is required for audit logging.',
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = (): void => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('ReasonRequiredModal: action failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const canSubmit = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${iconWrapperClassName}`}
            >
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-4">
          {description && (
            <p className="text-sm text-gray-700 mb-4">{description}</p>
          )}

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            <div className="mb-6">
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {reasonLabel} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                }}
                rows={3}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder={placeholder}
              />
              {reason.trim().length === 0 && (
                <p className="text-xs text-gray-500 mt-1">{helperText}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClassName}`}
              >
                {isSubmitting ? confirmingLabel : confirmLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReasonRequiredModal;
