import React from 'react';
import { ArrowUpTrayIcon, ChartBarIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const evidenceSections: Array<{ key: string; title: string; helper?: string; commentPlaceholder: string; emptyMessage: string }> = [
  {
    key: 'sanctions',
    title: 'Sanctions Screening',
    helper: 'Upload evidence gathered during sanctions screening',
    commentPlaceholder: 'Add any notes about the sanctions screening results...',
    emptyMessage: 'No sanctions screening evidence attached',
  },
  {
    key: 'adverse-media',
    title: 'Adverse Media Screening',
    helper: 'Attach supporting documents from adverse media checks',
    commentPlaceholder: 'Summarise any key findings from adverse media screening...',
    emptyMessage: 'No adverse media screening evidence attached',
  },
  {
    key: 'others',
    title: 'Others',
    helper: 'Add any additional evidence that supports this task',
    commentPlaceholder: 'Provide context for the additional evidence...',
    emptyMessage: 'No other evidence attached',
  },
];

const TaskEvidenceTab: React.FC = () => {
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [sectionFiles, setSectionFiles] = React.useState<Record<string, File[]>>({});

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
    }
    
    // Reset the input value to allow selecting the same file again if needed
    event.target.value = '';
    console.log('Input value reset');
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
            {/* File Preview Section */}
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Attached Files</div>
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
                      <span className="text-xs text-gray-400">Ready to upload</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm italic text-gray-500">
                  {section.emptyMessage}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${section.key}-comments`} className="mb-1 block text-xs font-medium text-gray-700">
                Comments
              </label>
              <textarea
                id={`${section.key}-comments`}
                placeholder={section.commentPlaceholder}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>
      ))}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-1 focus:ring-gray-400"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-1 focus:ring-blue-600"
        >
          <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
          Save Task
        </button>
      </div>
    </div>
  );
};

export default TaskEvidenceTab;
