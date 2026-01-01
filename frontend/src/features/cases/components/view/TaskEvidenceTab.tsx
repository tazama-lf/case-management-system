import React from 'react';
import {
  ArrowUpTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { evidenceService } from '../../services/evidenceService';
import type { Evidence, EvidenceType, UploadEvidenceDto } from '../../types/evidence.types';
import DeleteEvidenceModal from '../modals/DeleteEvidenceModal';
import { useToast } from '../../../../shared/providers/ToastProvider';
import type { TaskForSupervisor } from '../../services/taskService';
import { TaskStatus } from '../../services/taskService';

const evidenceSections: Array<{
  key: string;
  title: string;
  helper?: string;
  commentPlaceholder: string;
  emptyMessage: string;
  evidenceType: EvidenceType;
}> = [
    {
      key: 'kyc-edd',
      title: 'KYC/EDD Report',
      helper: 'Upload KYC/EDD documentation',
      commentPlaceholder: 'Add comments about the KYC/EDD report...',
      emptyMessage: 'No KYC/EDD report attached',
      evidenceType: 'KYC',
    },
    {
      key: 'sanctions',
      title: 'Sanctions Screening',
      helper: 'Upload evidence gathered during sanctions screening',
      commentPlaceholder: 'Add any notes about the sanctions screening results...',
      emptyMessage: 'No sanctions screening evidence attached',
      evidenceType: 'SANCTIONS',
    },
    {
      key: 'adverse-media',
      title: 'Adverse Media Screening',
      helper: 'Attach supporting documents from adverse media checks',
      commentPlaceholder: 'Summarise any key findings from adverse media screening...',
      emptyMessage: 'No adverse media screening evidence attached',
      evidenceType: 'ADVERSE_MEDIA',
    },
    {
      key: 'others',
      title: 'Others',
      helper: 'Add any additional evidence that supports this task',
      commentPlaceholder: 'Provide context for the additional evidence...',
      emptyMessage: 'No other evidence attached',
      evidenceType: 'OTHER',
    },
  ];

interface TaskEvidenceTabProps {
  task: TaskForSupervisor;
  caseId?: string;
  onUploadComplete?: () => void;
  onSaveRequest?: (uploadFn: () => Promise<void>) => void;
}

const TaskEvidenceTab: React.FC<TaskEvidenceTabProps> = ({
  task,
  onUploadComplete,
  onSaveRequest,
}) => {
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [sectionFiles, setSectionFiles] = React.useState<Record<string, File[]>>({});
  const [sectionComments, setSectionComments] = React.useState<Record<string, string>>({});
  const [uploadedEvidence, setUploadedEvidence] = React.useState<Record<string, Evidence[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const taskId = task?.task_id;
  const isTaskCompleted = task?.status === TaskStatus.STATUS_30_COMPLETED;

  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [noEvidenceError, setNoEvidenceError] = React.useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = React.useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const { success, error } = useToast();
  const allowedFileTypes: Record<string, string[]> = {
    'sanctions': ['pdf', 'docx', 'txt', 'ppt', 'epub', 'html', 'png', 'jpeg', 'jpg', 'tiff'],
    'adverse-media': ['pdf', 'docx', 'txt', 'ppt', 'epub', 'html', 'png', 'jpeg', 'jpg', 'tiff'],
    'kyc-edd': ['pdf', 'docx', 'txt', 'ppt', 'epub', 'html', 'png', 'jpeg', 'jpg', 'tiff'],
    'sar-str': ['pdf', 'docx', 'txt', 'ppt', 'epub', 'html', 'png', 'jpeg', 'jpg', 'tiff'],
    'others': ['mp3', 'css', 'json', 'pdf', 'docx', 'txt', 'ppt', 'epub', 'html', 'png', 'jpeg', 'jpg'],
  };

  const maxFilesPerSection: Record<string, number> = {
    'sanctions': 5,
    'adverse-media': 5,
    'kyc-edd': 5,
    'sar-str': 5,
    'others': 10,
  };

  const UploadEvidence = async () => {
    if (!taskId) return;

    const sectionsToUpload = Object.entries(sectionFiles).filter(
      ([_, files]) => files.length > 0
    );

    if (sectionsToUpload.length === 0) {
      setNoEvidenceError(true);
      setTimeout(() => setNoEvidenceError(false), 3000);
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setNoEvidenceError(false);

    try {
      const uploadPromises = sectionsToUpload.flatMap(([sectionKey, files]) => {
        const section = evidenceSections.find(s => s.key === sectionKey);
        if (!section) return [];

        return files.map((file) =>
          evidenceService.uploadEvidence({
            file,
            taskId,
            evidenceType: section.evidenceType,
            description: sectionComments[sectionKey] || `${section.title} evidence`,
            comments: sectionComments[sectionKey],
          })
        );
      });

      await Promise.all(uploadPromises);

      setSectionFiles({});
      setSectionComments({});
      setSaveSuccess(true);
      await loadEvidence();
      onUploadComplete?.();
      success('Evidence uploaded successfully');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      error('Failed to upload evidence.');
    } finally {
      setSaving(false);

    }
  };


  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };


  const loadEvidence = React.useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const response = await evidenceService.getTaskEvidence(taskId);

      // Group evidence by type
      const grouped: Record<string, Evidence[]> = {
        'kyc-edd': [],
        sanctions: [],
        'adverse-media': [],
        others: [],
      };

      response.evidence.forEach((evidence) => {
        if (evidence.evidenceType === 'KYC' || evidence.evidenceType === 'EDD') {
          grouped['kyc-edd'].push(evidence);
        } else if (evidence.evidenceType === 'SANCTIONS') {
          grouped.sanctions.push(evidence);
        } else if (evidence.evidenceType === 'ADVERSE_MEDIA') {
          grouped['adverse-media'].push(evidence);
        } else {
          grouped.others.push(evidence);
        }
      });

      setUploadedEvidence(grouped);
    } catch (error) {
      console.error('Failed to load evidence:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  React.useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  const handleUploadEvidence = async () => {
    if (!taskId) {
      throw new Error('No task ID available');
    }

    const sectionsToUpload = Object.entries(sectionFiles).filter(([_, files]) => files.length > 0);

    if (sectionsToUpload.length === 0) {
      return;
    }

    setUploading({ sanctions: true, 'adverse-media': true, others: true });

    try {
      const uploadPromises = sectionsToUpload.flatMap(([sectionKey, files]) => {
        const section = evidenceSections.find(s => s.key === sectionKey);
        if (!section) return [];

        return files.map(async (files) => {
          const uploadDto: UploadEvidenceDto = {
            file: files,
            taskId: taskId,
            evidenceType: section.evidenceType,
            description: sectionComments[sectionKey] || `${section.title} evidence`,
            comments: sectionComments[sectionKey],
          };

          return evidenceService.uploadEvidence(uploadDto);
        });
      });

      await Promise.all(uploadPromises);

      setSectionFiles({});
      setSectionComments({});

      // Reload evidence to show newly uploaded files
      const response = await evidenceService.getTaskEvidence(taskId);
      const grouped: Record<string, Evidence[]> = {
        'kyc-edd': [],
        sanctions: [],
        'adverse-media': [],
        others: [],
      };

      response.evidence.forEach((evidence) => {
        if (evidence.evidenceType === 'KYC' || evidence.evidenceType === 'EDD') {
          grouped['kyc-edd'].push(evidence);
        } else if (evidence.evidenceType === 'SANCTIONS') {
          grouped.sanctions.push(evidence);
        } else if (evidence.evidenceType === 'ADVERSE_MEDIA') {
          grouped['adverse-media'].push(evidence);
        } else {
          grouped.others.push(evidence);
        }
      });

      setUploadedEvidence(grouped);

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Failed to upload evidence:', error);
      throw error;
    } finally {
      setUploading({});
    }
  };

  React.useEffect(() => {
    if (onSaveRequest) {
      onSaveRequest(handleUploadEvidence);
    }
  }, [onSaveRequest, sectionFiles, sectionComments, taskId]);



  const handleAttachClick = (sectionKey: string) => {
    const input = fileInputRefs.current[sectionKey];

    if (input) {
      try {
        input.click();
      } catch (error) {
        console.error('Error clicking input:', error);
      }
    } else {
      console.error('Input element not found for section:', sectionKey);
    }
  };

  // const handleFilesSelected = (sectionKey: string, fileList: FileList | null) => {
  //   if (!fileList || fileList.length === 0) return;

  //   setSectionFiles((prev) => {
  //     const existing = prev[sectionKey] ?? [];


  //     const sanitizedFiles = Array.from(fileList).map(file => {
  //       const sanitizedFile = new File([file], file.name.replace(/[^\w.\-() ]+/g, '_'), {
  //         type: file.type,
  //       });
  //       return sanitizedFile;
  //     });

  //     const nextFiles = [...existing, ...sanitizedFiles];
  //     return { ...prev, [sectionKey]: nextFiles };
  //   });
  //   // setSectionFiles((prev) => {
  //   //   const existing = prev[sectionKey] ?? [];
  //   //   const nextFiles = [...existing, ...Array.from(fileList)];
  //   //   return { ...prev, [sectionKey]: nextFiles };
  //   // });
  // };

  const handleFilesSelected = (sectionKey: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const existingPending = sectionFiles[sectionKey] ?? [];
    const existingUploaded = uploadedEvidence[sectionKey] ?? [];
    const maxFiles = maxFilesPerSection[sectionKey] || 5;

    // Total files if we add these new ones
    if (existingPending.length + existingUploaded.length + fileList.length > maxFiles) {
      error(`Cannot attach files. Maximum ${maxFiles} files allowed for section ${sectionKey}`);
      return; // Reject new files entirely
    }

    const sanitizedFiles: File[] = Array.from(fileList)
      .map(file => new File([file], file.name.replace(/[^\w.\-() ]+/g, '_'), { type: file.type }))
      .filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowedFileTypes[sectionKey]?.includes(ext)) {
          error(`File type not allowed for ${sectionKey}: ${file.name}`);
          return false;
        }
        if (file.size > 50 * 1024 * 1024) {
          error(`File exceeds 50MB: ${file.name}`);
          return false;
        }
        return true;
      });

    if (sanitizedFiles.length === 0) return; // nothing to add

    setSectionFiles(prev => ({
      ...prev,
      [sectionKey]: [...existingPending, ...sanitizedFiles],
    }));
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, sectionKey: string) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFilesSelected(sectionKey, event.target.files);

      setTimeout(() => {
        event.target.value = '';
      }, 0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, exponent);
    return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">Evidence & Documents</div>
        <button
          type="button"
          onClick={UploadEvidence}
          disabled={saving || !Object.values(sectionFiles).some(files => files.length > 0) || isTaskCompleted}
          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm
        ${saving || !Object.values(sectionFiles).some(files => files.length > 0)
              ? 'border-green-600 bg-green-600/70 text-white cursor-not-allowed'
              : 'border-green-600 bg-green-600 text-white hover:bg-green-700'}
        `}
        >
          <CheckCircleIcon className="h-4 w-4" />
          {saving ? 'Uploading...' : 'Upload Evidence'}
        </button>
      </div>

      {evidenceSections.map((section) => {
        const isOpen = openSections[section.key];

        return (
          <section
            key={section.key}
            className="rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            {/* HEADER */}
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  {section.title}
                </h4>
                {section.helper && (
                  <p className="text-xs text-gray-500">{section.helper}</p>
                )}
              </div>
              {isOpen ? (
                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {/* BODY */}
            {isOpen && (
              <div className="space-y-4 border-t p-4">
                <input
                  type="file"
                  multiple
                  hidden
                  accept={
                    section.key in allowedFileTypes
                      ? allowedFileTypes[section.key].map(ext => `.${ext}`).join(',')
                      : '*'
                  }
                  ref={(el) => {
                    fileInputRefs.current[section.key] = el;
                  }}
                  onChange={(e) => handleFileChange(e, section.key)}
                />

                {/* Pending Upload */}
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Pending Upload
                  </div>
                  {sectionFiles[section.key]?.length ? (

                    <div className="flex items-start gap-2">
                      {/* Files List */}
                      <ul className="space-y-2 flex-1">
                        {sectionFiles[section.key].map((file, index) => (
                          <li
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                          >
                            <div className="truncate">
                              <p className="truncate font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">Ready to upload</span>
                              <button
                                disabled={isTaskCompleted}
                                type="button"
                                className="rounded-md p-1 text-red-600 hover:bg-red-100 hover:text-red-700"
                                title="Remove Upload"
                                onClick={() => {
                                  setSectionFiles((prev) => ({
                                    ...prev,
                                    [section.key]: prev[section.key].filter((_, i) => i !== index),
                                  }));
                                }}
                              >
                                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                              </button>
                            </div>
                          </li>

                        ))}
                      </ul>

                    </div>


                  ) : (
                    <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm italic text-gray-500">
                      No files pending
                    </p>
                  )}

                </div>

                {/* Uploaded Evidence */}
                {uploadedEvidence[section.key]?.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Uploaded Evidence ({uploadedEvidence[section.key].length})
                    </div>
                    {loading ? (
                      <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm italic text-gray-500">
                        Loading...
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {uploadedEvidence[section.key].map((evidence) => (
                          <li
                            key={evidence.id}
                            className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm shadow-sm"
                          >
                            {/* Left content */}
                            <div className="truncate flex-1">
                              <div className="flex items-center gap-2">
                                <p
                                  className="truncate font-medium text-gray-900"
                                  title={evidence.fileName}
                                >
                                  {evidence.fileName}
                                </p>

                                {section.key === 'kyc-edd' && (
                                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                    {evidence.evidenceType}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-gray-500">
                                Uploaded {new Date(evidence.uploadedAt).toLocaleString()}
                              </p>
                            </div>

                            {/* Right actions */}
                            <div className="ml-3 flex items-center gap-2">
                              <span className="text-xs text-green-600">✓ Uploaded</span>

                              <button
                                type="button"
                                onClick={() => setEvidenceToDelete({ id: evidence.id, fileName: evidence.fileName })}
                                className="rounded-md p-1 text-red-600 hover:bg-red-100 hover:text-red-700"
                                title="Delete Evidence"
                              >
                                <TrashIcon className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                    )}
                  </div>
                )}

                {/* Comments */}
                <div>
                  <label
                    htmlFor={`${section.key}-comments`}
                    className="mb-1 block text-xs font-medium text-gray-700"
                  >
                    Comments
                  </label>
                  <textarea
                    id={`${section.key}-comments`}
                    placeholder={section.commentPlaceholder}
                    rows={4}
                    value={sectionComments[section.key] || ''}
                    onChange={(e) =>
                      setSectionComments((prev) => ({
                        ...prev,
                        [section.key]: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isTaskCompleted}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAttachClick(section.key);
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowUpTrayIcon className="h-5 w-5" aria-hidden="true" />
                      Attach
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
      {evidenceToDelete && (
        <DeleteEvidenceModal
          evidenceToDelete={evidenceToDelete}
          setEvidenceToDelete={setEvidenceToDelete}
          setUploadedEvidence={setUploadedEvidence}
          onDeleteSuccess={() => {
            loadEvidence();
            onUploadComplete?.();
          }}
        />
      )}
    </div>
  );
};

export default TaskEvidenceTab;