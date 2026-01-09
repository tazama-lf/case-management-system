import React, { useState, useEffect, lazy, Suspense } from 'react';
import { XMarkIcon, ArrowUpTrayIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { evidenceService } from '../../services/evidenceService';
import type { Evidence, UploadEvidenceDto } from '../../types/evidence.types';
import { useToast } from '../../../../shared/providers/ToastProvider';
import type { Case } from '@/features/alerts/types/triage.types';
import type { UnifiedWorkQueueTask } from '@/features/workqueue/types/flowable.types';
import { taskService, TaskStatus, type TaskStatusType } from '../../services/taskService';
import type { CaseWithTasksDto } from '../../services/caseService';


const CompleteTaskModal = lazy(() => import('../modals/CompleteTaskModal'));
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
  // const [sarSubmissionDate, setSarSubmissionDate] = React.useState('');
  // const [sarAckNumber, setSarAckNumber] = React.useState('');
  // const [sarSubmissionChannel, setSarSubmissionChannel] = React.useState('');
  const [sarRemarks, setSarRemarks] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();
  const [completeTaskModalOpen, setCompleteTaskModalOpen] = useState(false);
  // Load existing SAR/STR evidence when modal opens
  useEffect(() => {
    if (!open || !taskId) return;

    const loadEvidence = async () => {
      setLoading(true);
      try {
        const response = await evidenceService.getTaskEvidence(taskId);

        // Filter only SAR/STR filings
        const sarStrEvidence = response.evidence.filter((evidence) =>
          evidence.evidenceType === 'SAR_STR_FILING' ||
          evidence.description?.includes('SAR/STR') ||
          evidence.description?.includes('Regulatory Filing')
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
      // setSarSubmissionDate('');
      // setSarAckNumber('');
      // setSarSubmissionChannel('');
      setSarRemarks('');
    }
  }, [open]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxFiles = 5;
    const totalExisting =
      selectedFiles.length + uploadedEvidence.length;

    if (totalExisting + files.length > maxFiles) {
      error(`Cannot attach files. Maximum ${maxFiles} files allowed for SAR/STR`);
      event.target.value = '';
      return;
    }

    const allowedExtensions = ['pdf', 'docx', 'txt', 'ppt', 'epub', 'html', 'png', 'jpeg', 'jpg', 'tiff'];

    const sanitizedFiles: File[] = Array.from(files)
      .map(
        (file) =>
          new File(
            [file],
            file.name.replace(/[^\w.\-() ]+/g, '_'),
            { type: file.type }
          )
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


  const handleModalCompleteTask = async (task: UnifiedWorkQueueTask, notes?: string, recommendedOutcome?: string) => {
    try {
      const updateData: { status: TaskStatusType; recommendedOutcome?: string; finalNotes?: string } = {
        status: TaskStatus.STATUS_30_COMPLETED
      };

      // Add recommended outcome if provided (for AML/Fraud investigation tasks)
      if (recommendedOutcome) {
        updateData.recommendedOutcome = recommendedOutcome;
      }

      // Add final notes if provided
      if (notes && notes.trim()) {
        updateData.finalNotes = notes.trim();
      }

      await taskService.updateTaskForSupervisor(task.id, updateData);
      setCompleteTaskModalOpen(false);
      onClose();
      onTaskUpdate?.();



      success('Task Completed Successfully', `Task ${task.id} has been completed successfully.`);
    } catch (err) {
      error('Complete Task Failed', error instanceof Error ? error.message : 'Failed to complete task');
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }
    // Commented out validation for now - only file and comments required
    // if (!sarSubmissionDate || !sarAckNumber || !sarSubmissionChannel) {
    //   alert('Please fill in all required fields (Submission Date, Acknowledgment Number, and Submission Channel)');
    //   return;
    // }

    setUploading(true);
    try {
      // Build description with SAR/STR metadata
      // const metadata = `SAR/STR Filing - Regulatory Filing | Submitted: ${sarSubmissionDate} | Ref: ${sarAckNumber} | Channel: ${sarSubmissionChannel}`;
      const metadata = 'SAR/STR Filing - Regulatory Filing';
      const fullDescription = sarRemarks ? `${metadata}\n\nRemarks: ${sarRemarks}` : metadata;

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
      // setSarSubmissionDate('');
      // setSarAckNumber('');
      // setSarSubmissionChannel('');
      setSarRemarks('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload evidence
      const response = await evidenceService.getTaskEvidence(taskId);
      const sarStrEvidence = response.evidence.filter((evidence) =>
        evidence.evidenceType === 'SAR_STR_FILING' ||
        evidence.description?.includes('SAR/STR') ||
        evidence.description?.includes('Regulatory Filing')
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
      await evidenceService.downloadEvidence(evidence.id);
    } catch (error) {
      console.error('Failed to download evidence:', error);
      alert('Failed to download evidence');
    }
  };



  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 overflow-y-auto">
        <div className="mt-6 mb-6 w-full max-w-4xl rounded-lg bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                SAR/STR Filing
              </h3>
              {caseName && (
                <p className="text-sm text-gray-600 mt-1">
                  Case: {caseName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-6">
            {/* Instructions Banner */}
            <div className="rounded-lg p-0">
              <div className="flex items-center gap-2 mb-2">
                <DocumentCheckIcon className="h-6 w-6 text-black-700" />
                <h4 className="text-base font-semibold text-black-900">
                  SAR/STR Filing Documentation
                </h4>
              </div>
              <p className="text-sm text-black-800">
                Upload required documents and add your comments for the SAR/STR filing process.
              </p>
            </div>

            {/* Upload Form */}
            <div className="space-y-4">
              {/* Submission Metadata Fields - Commented out for now */}
              {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sar-submission-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Submission <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="sar-submission-date"
                  value={sarSubmissionDate}
                  onChange={(e) => setSarSubmissionDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="sar-ack-number" className="block text-sm font-medium text-gray-700 mb-1">
                  Acknowledgment/Reference Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="sar-ack-number"
                  value={sarAckNumber}
                  onChange={(e) => setSarAckNumber(e.target.value)}
                  placeholder="e.g., FIU/2025/12345"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="sar-submission-channel" className="block text-sm font-medium text-gray-700 mb-1">
                  Submission Channel <span className="text-red-500">*</span>
                </label>
                <select
                  id="sar-submission-channel"
                  value={sarSubmissionChannel}
                  onChange={(e) => setSarSubmissionChannel(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Select submission channel...</option>
                  <option value="goAML Portal">goAML Portal</option>
                  <option value="Email">Email</option>
                  <option value="FIU Web Portal">FIU Web Portal</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div> */}

              {/* File Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
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
                    disabled={task.status.toLowerCase().includes('completed')}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Select Files
                  </button>
                </div>

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2"
                      >
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {file.name} <span className="text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span>
                        </span>
                        <button
                          type="button"
                          disabled={task.status.toLowerCase().includes('completed')}
                          onClick={() => handleRemoveFile(index)}
                          className="ml-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                          aria-label="Remove file"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, , TXT, JPG, PNG, TIFF, PPT, EPUB, HTML
                </p>
              </div>

              {/* Remarks Field */}
              <div>
                <label htmlFor="sar-remarks" className="block text-sm font-medium text-gray-700 mb-1">
                  Comments
                </label>
                <textarea
                  id="sar-remarks"
                  value={sarRemarks}
                  onChange={(e) => setSarRemarks(e.target.value)}
                  rows={4}
                  placeholder="Add any comments about this SAR/STR filing..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Upload Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || selectedFiles.length === 0 || task.status.toLowerCase().includes('completed')}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowUpTrayIcon className="h-5 w-5" />
                  {uploading ? 'Uploading...' : 'Save SAR/STR Filing'}
                </button>
              </div>
            </div>

            {/* Previously Uploaded SAR/STR Filings */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
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
                  {uploadedEvidence.map((evidence) => (
                    <div
                      key={evidence.id}
                      className="flex items-start justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <DocumentCheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900">
                            {evidence.fileName}
                          </span>
                        </div>
                        {evidence.description && (
                          <p className="text-xs text-gray-600 whitespace-pre-line mt-2">
                            {evidence.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Uploaded: {new Date(evidence.uploadedAt).toLocaleString()} by {evidence.uploadedBy}
                        </p>
                      </div>
                      {/* <button
                      type="button"
                      onClick={() => handleDownloadEvidence(evidence)}
                      className="ml-4 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      Download
                    </button> */}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-gray-200 px-6 py-4 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              Close
            </button>
            {!task.status.toLocaleLowerCase().includes('complete') && (
              <button
                type="button"
                onClick={() => setCompleteTaskModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm border-green-600 bg-green-600 text-white hover:bg-green-700"
              >
                Mark as Complete
              </button>
            )}
          </div>
        </div>
      </div>
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
