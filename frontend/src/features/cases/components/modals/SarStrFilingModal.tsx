import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentCheckIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { evidenceService } from '../../services/evidenceService';
import type { Evidence, UploadEvidenceDto } from '../../types/evidence.types';
import { useToast } from '../../../../shared/providers/ToastProvider';
import type { UnifiedWorkQueueTask } from '../../types/task.types';
import {
  taskService,
  TaskStatus,
  type TaskStatusType,
} from '../../services/taskService';
import { useAuth } from '@/features/auth';
import DeleteEvidenceModal from '../modals/DeleteEvidenceModal';
import { formatDate } from '@/shared/utils/dateUtils';
import { useInvestigatorSupervisorList } from '../../hooks/useInvestigatorSupervisorList';

const CompleteTaskModal = lazy(
  async () => await import('../modals/CompleteTaskModal'),
);
interface SarStrFilingModalProps {
  open: boolean;
  onClose: () => void;
  taskId: number;
  caseId: number;
  caseName?: string;
  onTaskUpdate?: () => void;
  task: UnifiedWorkQueueTask;
}

const SarStrFilingModal: React.FC<SarStrFilingModalProps> = ({
  open,
  onClose,
  taskId,
  caseName,
  onTaskUpdate,
  task,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sarRemarks, setSarRemarks] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();
  const [completeTaskModalOpen, setCompleteTaskModalOpen] = useState(false);
  const { hasComplianceOfficerRole, hasSupervisorRole } = useAuth();
  const { getAssigneeFullName } = useInvestigatorSupervisorList();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [evidenceToDelete, setEvidenceToDelete] = React.useState<{
    id: string;
    fileName: string;
  } | null>(null);
  // Load existing SAR/STR evidence when modal opens
  useEffect(() => {
    if (!open || !taskId) return;

    const loadEvidence = async () => {
      setLoading(true);
      try {
        const response = await evidenceService.getTaskEvidence(taskId);

        // Filter only SAR/STR filings
        const sarStrEvidence = response.evidence.filter(
          (evidence) =>
            evidence.evidenceType === 'SAR_STR_FILING' ||
            evidence.description?.includes('SAR/STR') ||
            evidence.description?.includes('Regulatory Filing'),
        );

        setUploadedEvidence(sarStrEvidence);
      } catch (err) {
        console.error('Failed to load evidence:', err);
        error('Failed to load evidence');
      } finally {
        setLoading(false);
      }
    };

    loadEvidence();
  }, [open, taskId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedFiles([]);
      setSarRemarks('');
    }
  }, [open]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) return;

    const maxFiles = 5;
    const totalExisting = selectedFiles.length + uploadedEvidence.length;

    if (totalExisting + files.length > maxFiles) {
      error(
        `Cannot attach files. Maximum ${maxFiles} files allowed for SAR/STR`,
      );
      event.target.value = '';
      return;
    }

    const allowedExtensions = [
      'pdf',
      'docx',
      'txt',
      'ppt',
      'epub',
      'html',
      'png',
      'jpeg',
      'jpg',
      'tiff',
    ];

    const sanitizedFiles: File[] = Array.from(files)
      .map(
        (file) =>
          new File([file], file.name.replace(/[^\w.\-() ]+/gu, '_'), {
            type: file.type,
          }),
      )
      .filter((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        if (!allowedExtensions.includes(ext)) {
          error(`File type not allowed for SAR/STR: ${file.name}`);
          return false;
        }

        if (file.size > 50 * 1024 * 1024) {
          error(`File exceeds 50MB: ${file.name}`);
          return false;
        }

        return true;
      });

    if (sanitizedFiles.length === 0) {
      event.target.value = '';
      return;
    }

    setSelectedFiles((prev) => [...prev, ...sanitizedFiles]);
    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleModalCompleteTask = async (
    task: UnifiedWorkQueueTask,
    notes?: string,
    recommendedOutcome?: string,
  ) => {
    try {
      const updateData: {
        status: TaskStatusType;
        recommendedOutcome?: string;
        finalNotes?: string;
      } = {
        status: TaskStatus.STATUS_30_COMPLETED,
      };

      // Add recommended outcome if provided (for AML/Fraud investigation tasks)
      if (recommendedOutcome) {
        updateData.recommendedOutcome = recommendedOutcome;
      }

      // Add final notes if provided
      if (notes?.trim()) {
        updateData.finalNotes = notes.trim();
      }

      await taskService.completeTask(task.id);
      setCompleteTaskModalOpen(false);
      onClose();
      onTaskUpdate?.();

      success(
        'Task Completed Successfully',
        `Task ${task.id} has been completed successfully.`,
      );
    } catch (err) {
      error(
        'Complete Task Failed',
        error instanceof Error ? error.message : 'Failed to complete task',
      );
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }
    setUploading(true);
    try {
      const metadata = 'SAR/STR Filing - Regulatory Filing';
      const fullDescription = sarRemarks
        ? `${metadata}\n\nRemarks: ${sarRemarks}`
        : metadata;

      for (const file of selectedFiles) {
        const uploadDto: UploadEvidenceDto = {
          taskId,
          evidenceType: 'SAR_STR_FILING',
          description: fullDescription,
          comments: sarRemarks,
          file,
        };

        await evidenceService.uploadEvidence(uploadDto);
      }

      // Clear form after successful upload
      setSelectedFiles([]);
      setSarRemarks('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload evidence
      const response = await evidenceService.getTaskEvidence(taskId);
      const sarStrEvidence = response.evidence.filter(
        (evidence) =>
          evidence.evidenceType === 'SAR_STR_FILING' ||
          evidence.description?.includes('SAR/STR') ||
          evidence.description?.includes('Regulatory Filing'),
      );
      setUploadedEvidence(sarStrEvidence);

      success('SAR/STR filing uploaded successfully');
    } catch (err) {
      console.error('Failed to upload SAR/STR filing:', err);
      error('Failed to upload SAR/STR filing. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadEvidence = async (evidence: Evidence) => {
    try {
      setDownloadingId(evidence.id.toString());

      const blob = await evidenceService.downloadEvidence(evidence.id);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = evidence.fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download evidence:', err);
      error('Failed to download evidence');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 overflow-y-auto">
        <div className="my-4 w-full max-w-3xl rounded-lg bg-white shadow-lg max-h-[calc(100vh-2rem)] flex flex-col">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 flex-shrink-0">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                SAR/STR Filing
              </h3>
              {caseName && (
                <p className="text-xs text-gray-600 mt-0.5">Case: {caseName}</p>
              )}
              {hasSupervisorRole() && (
                <p className="text-xs text-gray-600 mt-0.5">
                  Only the Compliance Officer is authorized to fill and submit
                  the SAR/STR.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
            {/* Instructions Banner */}
            <div className="rounded-lg p-0">
              <div className="flex items-center gap-2 mb-1.5">
                <DocumentCheckIcon className="h-5 w-5 text-black-700" />
                <h4 className="text-sm font-semibold text-black-900">
                  SAR/STR Filing Documentation
                </h4>
              </div>
              <p className="text-xs text-black-800">
                Upload required documents and add your comments for the SAR/STR
                filing process.
              </p>
            </div>

            {/* Upload Form */}
            <div className="space-y-3.5">
              {/* File Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-700">
                    Attach Files <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.ppt,.epub,.html,.png,.jpeg,.jpg,.tiff"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="sar-str-file-input"
                  />
                  <button
                    disabled={
                      task.status.toLowerCase().includes('completed') ||
                      !hasComplianceOfficerRole()
                    }
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Select Files
                  </button>
                </div>

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5"
                      >
                        <span className="text-xs text-gray-700 truncate flex-1">
                          {file.name}{' '}
                          <span className="text-gray-500">
                            ({(file.size / 1024).toFixed(2)} KB)
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={
                            task.status.toLowerCase().includes('completed') ||
                            !hasComplianceOfficerRole()
                          }
                          onClick={() => {
                            handleRemoveFile(index);
                          }}
                          className="ml-2 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Remove file"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, , TXT, JPG, PNG, TIFF, PPT,
                  EPUB, HTML
                </p>
              </div>

              {/* Remarks Field */}
              <div>
                <label
                  htmlFor="sar-remarks"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Comments
                </label>

                <textarea
                  id="sar-remarks"
                  value={sarRemarks}
                  onChange={(e) => {
                    setSarRemarks(e.target.value);
                  }}
                  rows={3}
                  maxLength={500}
                  placeholder="Add any comments about this SAR/STR filing..."
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                <div className="mt-1">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs ${
                        sarRemarks.length === 500
                          ? 'text-red-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {sarRemarks.length}/500
                    </span>
                  </div>

                  <div className="mt-1">
                    {sarRemarks.length === 500 ? (
                      <p className="text-red-500 text-xs">
                        Maximum character limit reached
                      </p>
                    ) : (
                      <p className="text-gray-500 text-xs">
                        Comments help with case investigation and audit trails
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={
                    uploading ||
                    selectedFiles.length === 0 ||
                    task.status.toLowerCase().includes('completed') ||
                    !hasComplianceOfficerRole()
                  }
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Save SAR/STR Filing'}
                </button>
              </div>
            </div>

            {/* Previously Uploaded SAR/STR Filings */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs font-semibold text-gray-900 mb-3">
                Previously Uploaded SAR/STR Filings ({uploadedEvidence.length})
              </h4>

              {loading ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  Loading evidence...
                </div>
              ) : uploadedEvidence.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No SAR/STR filings uploaded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {uploadedEvidence.length > 0 && (
                    <div className="space-y-2">
                      {uploadedEvidence.map((evidence) => (
                        <div
                          key={evidence.id}
                          className="flex items-start justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <div className="truncate flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <DocumentCheckIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span className="truncate text-xs font-medium text-gray-900">
                                {evidence.fileName}
                              </span>
                            </div>
                            {evidence.description && (
                              <p className="text-xs text-gray-600 whitespace-pre-line mt-1.5">
                                {evidence.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1.5">
                              Uploaded: {formatDate(evidence.uploadedAt)} by{' '}
                              {getAssigneeFullName(evidence.uploadedBy)}
                            </p>
                          </div>
                          {/* <div className="ml-3 flex items-center gap-2">
                            <span className="text-xs text-green-600">✓ Uploaded</span>

                            <button
                              disabled={task.status.toLowerCase().includes('completed') || !hasComplianceOfficerRole()}
                              type="button"
                              onClick={() =>
                                setEvidenceToDelete({ id: evidence.id, fileName: evidence.fileName })
                              }
                              className="rounded-md p-1 text-red-600 hover:bg-red-100 hover:text-red-700"
                              title="Delete Evidence"
                            >
                              <TrashIcon className="h-4.5 w-4.5" />
                            </button>
                          </div> */}
                          <div className="ml-3 flex items-center gap-2">
                            {/* Download */}
                            <button
                              type="button"
                              onClick={async () => {
                                await handleDownloadEvidence(evidence);
                              }}
                              disabled={
                                downloadingId === evidence.id.toString()
                              }
                              className="rounded-md p-1 text-blue-600 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50"
                              title="Download Evidence"
                            >
                              {downloadingId === evidence.id.toString() ? (
                                <ArrowPathIcon className="h-4.5 w-4.5 animate-spin" />
                              ) : (
                                <ArrowDownTrayIcon className="h-4.5 w-4.5" />
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              hidden={
                                task.status
                                  .toLowerCase()
                                  .includes('completed') ||
                                !hasComplianceOfficerRole()
                              }
                              disabled={
                                task.status
                                  .toLowerCase()
                                  .includes('completed') ||
                                !hasComplianceOfficerRole()
                              }
                              type="button"
                              onClick={() => {
                                setEvidenceToDelete({
                                  id: evidence.id,
                                  fileName: evidence.fileName,
                                });
                              }}
                              className="rounded-md p-1 text-red-600 hover:bg-red-100 hover:text-red-700"
                              title="Delete Evidence"
                            >
                              <TrashIcon className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer - Fixed */}
          <div className="flex items-center justify-end border-t border-gray-200 px-5 py-3 gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              Close
            </button>
            {hasComplianceOfficerRole() &&
              !task.status.toLowerCase().includes('completed') && (
                <button
                  disabled={uploadedEvidence.length === 0}
                  type="button"
                  onClick={() => {
                    setCompleteTaskModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm border-green-600 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Complete
                </button>
              )}
          </div>
        </div>
      </div>

      {evidenceToDelete && (
        <DeleteEvidenceModal
          evidenceToDelete={evidenceToDelete}
          setEvidenceToDelete={setEvidenceToDelete}
          setUploadedEvidence={setUploadedEvidence} // Evidence[] type
          onDeleteSuccess={() => {
            // Remove deleted evidence from the flat array
            setUploadedEvidence((prev) =>
              prev.filter((e) => e.id !== evidenceToDelete.id),
            );
            setEvidenceToDelete(null);
            success('Evidence deleted successfully');
          }}
        />
      )}

      {/* Complete Investigation Task Modal */}
      {completeTaskModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <CompleteTaskModal
            open={completeTaskModalOpen}
            onClose={() => {
              setCompleteTaskModalOpen(false);
            }}
            onCompleteTask={handleModalCompleteTask}
            task={task}
          />
        </Suspense>
      )}
    </>
  );
};

export default SarStrFilingModal;
