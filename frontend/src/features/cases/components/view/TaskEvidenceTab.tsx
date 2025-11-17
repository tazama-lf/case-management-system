import React from 'react';
import { ArrowUpTrayIcon, ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import GenerateTransactionProfileModal from '../modals/GenerateTransactionProfileModal';
import { evidenceService } from '../../services/evidenceService';
import type { Evidence, EvidenceType, UploadEvidenceDto } from '../../types/evidence.types';

const evidenceSections: Array<{ 
  key: string; 
  title: string; 
  helper?: string; 
  commentPlaceholder: string; 
  emptyMessage: string;
  evidenceType: EvidenceType;
}> = [
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
  taskId: string;
  onUploadComplete?: () => void;
  onSaveRequest?: (uploadFn: () => Promise<void>) => void;
}

const TaskEvidenceTab: React.FC<TaskEvidenceTabProps> = ({ 
  taskId,
  onUploadComplete,
  onSaveRequest,
}) => {
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [sectionFiles, setSectionFiles] = React.useState<Record<string, File[]>>({});
  const [sectionComments, setSectionComments] = React.useState<Record<string, string>>({});
  const [uploadedEvidence, setUploadedEvidence] = React.useState<Record<string, Evidence[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState<Record<string, boolean>>({});
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  


  // Load existing evidence for the task
  React.useEffect(() => {
    const loadEvidence = async () => {
      if (!taskId) return;
      
      setLoading(true);
      try {
        const response = await evidenceService.getTaskEvidence(taskId);
        
        // Group evidence by type
        const grouped: Record<string, Evidence[]> = {
          sanctions: [],
          'adverse-media': [],
          others: [],
        };

        response.evidence.forEach((evidence) => {
          if (evidence.evidenceType === 'SANCTIONS') {
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
    };

    loadEvidence();
  }, [taskId]);

  // Upload all evidence files
  const handleUploadEvidence = async () => {
    if (!taskId) {
      throw new Error('No task ID available');
    }

    const sectionsToUpload = Object.entries(sectionFiles).filter(([_, files]) => files.length > 0);
    
    if (sectionsToUpload.length === 0) {
      console.log('No files to upload');
      return;
    }

    setUploading({ sanctions: true, 'adverse-media': true, others: true });

    try {
      const uploadPromises = sectionsToUpload.flatMap(([sectionKey, files]) => {
        const section = evidenceSections.find(s => s.key === sectionKey);
        if (!section) return [];

        return files.map(async (file) => {
          const uploadDto: UploadEvidenceDto = {
            file,
            taskId,
            evidenceType: section.evidenceType,
            description: sectionComments[sectionKey] || `${section.title} evidence`,
            comments: sectionComments[sectionKey],
          };

          return evidenceService.uploadEvidence(uploadDto);
        });
      });

      await Promise.all(uploadPromises);

      // Clear uploaded files and comments
      setSectionFiles({});
      setSectionComments({});
      
      // Reload evidence to show newly uploaded files
      const response = await evidenceService.getTaskEvidence(taskId);
      const grouped: Record<string, Evidence[]> = {
        sanctions: [],
        'adverse-media': [],
        others: [],
      };

      response.evidence.forEach((evidence) => {
        if (evidence.evidenceType === 'SANCTIONS') {
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

  // Register upload function with parent
  React.useEffect(() => {
    if (onSaveRequest) {
      onSaveRequest(handleUploadEvidence);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSaveRequest, sectionFiles, sectionComments, taskId]);

  React.useEffect(() => {
    console.log('🔄 State changed:', sectionFiles);
    console.log('File counts:', Object.entries(sectionFiles).map(([key, files]) => `${key}: ${files.length}`));
  }, [sectionFiles]);

  const handleAttachClick = (sectionKey: string) => {
    console.log('=== Attach clicked ===');
    console.log('Section:', sectionKey);
    const input = fileInputRefs.current[sectionKey];
    console.log('Input element:', input);
    console.log('Input ref exists:', !!input);
    console.log('All refs:', Object.keys(fileInputRefs.current));
    
    if (input) {
      console.log('Attempting to click input...');
      try {
        input.click();
        console.log('Click triggered successfully');
      } catch (error) {
        console.error('Error clicking input:', error);
      }
    } else {
      console.error('Input element not found for section:', sectionKey);
    }
  };

  const handleFilesSelected = (sectionKey: string, fileList: FileList | null) => {
    console.log('handleFilesSelected called for', sectionKey, 'with', fileList?.length, 'files');
    if (!fileList || fileList.length === 0) return;

    setSectionFiles((prev) => {
      console.log('Previous state:', prev);
      const existing = prev[sectionKey] ?? [];
      console.log('Existing files for', sectionKey, ':', existing);
      const nextFiles = [...existing, ...Array.from(fileList)];
      console.log('Next files for', sectionKey, ':', nextFiles);
      const newState = { ...prev, [sectionKey]: nextFiles };
      console.log('New state:', newState);
      return newState;
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, sectionKey: string) => {
    console.log('=== File change event ===');
    console.log('Section:', sectionKey);
    console.log('Files:', event.target.files);
    console.log('File count:', event.target.files?.length);
    
    if (event.target.files && event.target.files.length > 0) {
      const fileArray = Array.from(event.target.files);
      console.log('File names:', fileArray.map((f) => f.name));
      handleFilesSelected(sectionKey, event.target.files);
      
      setTimeout(() => {
        event.target.value = '';
        console.log('Input value reset');
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
    <div className="space-y-6">
      {/* Save Progress Button */}
      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-1 focus:ring-gray-400"
        >
          <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
          Save Progress
        </button>
      </div>

      {/* Transaction Profile Analysis Section */}
      <section className="rounded-lg border border-purple-300 bg-purple-50/30 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Transaction Profile Analysis</h3>
            <p className="mt-1 text-xs text-gray-600">
              Generate a 90-day transaction profile to analyze behavioral patterns, identify anomalies, and compare against peer averages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-2 rounded-md border border-purple-600 bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-700 focus:ring-1 focus:ring-purple-600"
          >
            <ChartBarIcon className="h-4 w-4" aria-hidden="true" />
            Generate Profile
          </button>
        </div>
      </section>

      <div className="text-sm font-semibold text-gray-900">Evidence &amp; Documents</div>
      {evidenceSections.map((section) => (
        <section
          key={section.key}
          className="rounded-lg border border-gray-200 bg-white shadow-sm"
          aria-labelledby={`${section.key}-title`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div>
              <h4 id={`${section.key}-title`} className="text-sm font-medium text-gray-900">
                {section.title}
              </h4>
              {section.helper ? <p className="text-xs text-gray-500">{section.helper}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={(el) => {
                  if (el) {
                    fileInputRefs.current[section.key] = el;
                    console.log('Ref set for', section.key, el);
                  }
                }}
                id={`${section.key}-uploader`}
                type="file"
                multiple
                accept="*/*"
                style={{ display: 'none' }}
                onChange={(event) => handleFileChange(event, section.key)}
                aria-label={`Upload files for ${section.title}`}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Button clicked for:', section.key);
                  handleAttachClick(section.key);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-1 focus:ring-blue-600"
              >
                <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
                Attach Evidence
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {/* File Preview Section - Pending Upload */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Pending Upload
              </div>
              {sectionFiles[section.key]?.length ? (
                <ul className="space-y-2">
                  {sectionFiles[section.key].map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="truncate">
                        <p className="truncate font-medium text-gray-900" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      {uploading[section.key] ? (
                        <span className="text-xs text-blue-600">Uploading...</span>
                      ) : (
                        <span className="text-xs text-gray-400">Ready to upload</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm italic text-gray-500">
                  No files pending
                </p>
              )}
            </div>

            {/* Already Uploaded Evidence */}
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
                        <div className="truncate flex-1">
                          <p className="truncate font-medium text-gray-900" title={evidence.fileName}>
                            {evidence.fileName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(evidence.uploadedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs text-green-600 ml-2">✓ Uploaded</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}



            <div>
              <label htmlFor={`${section.key}-comments`} className="mb-1 block text-xs font-medium text-gray-700">
                Comments
              </label>
              <textarea
                id={`${section.key}-comments`}
                placeholder={section.commentPlaceholder}
                rows={4}
                value={sectionComments[section.key] || ''}
                onChange={(e) => setSectionComments(prev => ({ ...prev, [section.key]: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>
      ))}

      {/* Generate Transaction Profile Modal */}
      <GenerateTransactionProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
};

export default TaskEvidenceTab;
