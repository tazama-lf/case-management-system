import React from 'react';
import {
    ArrowUpTrayIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { evidenceService } from '../../services/evidenceService';
import type { Evidence, EvidenceType, UploadEvidenceDto } from '../../types/evidence.types';
import DeleteEvidenceModal from '../modals/DeleteEvidenceModal';

const regulatoryFilingSections: Array<{
    key: string;
    title: string;
    helper?: string;
    commentPlaceholder: string;
    emptyMessage: string;
    evidenceType: EvidenceType;
}> = [
        {
            key: 'sar-str',
            title: 'SAR/STR Files',
            helper: 'Upload Suspicious Activity Report (SAR) or Suspicious Transaction Report (STR) files',
            commentPlaceholder: 'Add comments about the SAR/STR filing details, timeline, or regulatory requirements...',
            emptyMessage: 'No SAR/STR files uploaded',
            evidenceType: 'REGULATORY_FILING',
        },
    ];

interface RegulatoryFillingTabProps {
    caseId?: number;
    taskId?: number;
    onUploadComplete?: () => void;
    onSaveRequest?: (uploadFn: () => Promise<void>) => void;
}

const RegulatoryFillingTab: React.FC<RegulatoryFillingTabProps> = ({
    taskId,
    onUploadComplete,
    onSaveRequest,
}) => {
    const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
    const [saveSuccess, setSaveSuccess] = React.useState(false);
    const uploadEvidenceRef = React.useRef<(() => Promise<void>) | null>(null);
    const [sectionFiles, setSectionFiles] = React.useState<Record<string, File[]>>({});
    const [sectionComments, setSectionComments] = React.useState<Record<string, string>>({});
    const [uploadedEvidence, setUploadedEvidence] = React.useState<Record<string, Evidence[]>>({});
    const [loading, setLoading] = React.useState(false);
    const [uploading, setUploading] = React.useState<Record<string, boolean>>({});
    const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
        'sar-str': false, // Open SAR/STR section by default
    });

    const [evidenceToDelete, setEvidenceToDelete] = React.useState<{
        id: number;
        fileName: string;
    } | null>(null);

    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    React.useEffect(() => {
        setSaveSuccess(false);
        uploadEvidenceRef.current = null;

        const loadEvidence = async () => {
            if (!taskId) return;

            setLoading(true);
            try {
                const response = await evidenceService.getTaskEvidence(taskId);

                // Group evidence by type
                const grouped: Record<string, Evidence[]> = {
                    'sar-str': [],
                    'regulatory-correspondence': [],
                    'compliance-reports': [],
                    'filing-receipts': [],
                };

                response.evidence.forEach((evidence) => {
                    if (evidence.evidenceType === 'REGULATORY_FILING') {
                        grouped['sar-str'].push(evidence);
                    }
                });

                setUploadedEvidence(grouped);
            } catch (error) {
                console.error('Failed to load regulatory evidence:', error);
            } finally {
                setLoading(false);
            }
        };

        loadEvidence();
    }, [taskId]);

    const handleUploadEvidence = async () => {
        if (!taskId) {
            throw new Error('No task ID available');
        }

        const sectionsToUpload = Object.entries(sectionFiles).filter(([_, files]) => files.length > 0);

        if (sectionsToUpload.length === 0) {
            return;
        }

        const uploadingStates = regulatoryFilingSections.reduce((acc, section) => {
            acc[section.key] = true;
            return acc;
        }, {} as Record<string, boolean>);

        setUploading(uploadingStates);

        try {
            const uploadPromises = sectionsToUpload.flatMap(([sectionKey, files]) => {
                const section = regulatoryFilingSections.find(s => s.key === sectionKey);
                if (!section) return [];

                return files.map(async (file) => {
                    const uploadDto: UploadEvidenceDto = {
                        file: file,
                        taskId,
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
                'sar-str': [],
                'regulatory-correspondence': [],
                'compliance-reports': [],
                'filing-receipts': [],
            };

            response.evidence.forEach((evidence) => {
                if (evidence.evidenceType === 'REGULATORY_FILING') {
                    grouped['sar-str'].push(evidence);
                }
            });

            setUploadedEvidence(grouped);

            if (onUploadComplete) {
                onUploadComplete();
            }
        } catch (error) {
            console.error('Failed to upload regulatory evidence:', error);
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

    const handleFilesSelected = (sectionKey: string, fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        setSectionFiles((prev) => {
            const existing = prev[sectionKey] ?? [];
            const nextFiles = [...existing, ...Array.from(fileList)];
            return { ...prev, [sectionKey]: nextFiles };
        });
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
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    Regulatory Filing Documents
                </div>
            </div>

            {regulatoryFilingSections.map((section) => {
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
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                    hidden
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
                                        <ul className="space-y-2">
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
                                            Uploaded Files ({uploadedEvidence[section.key].length})
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
                                        {saveSuccess && (
                                            <span className="text-sm text-green-600 font-medium">
                                                ✓ Regulatory files uploaded successfully
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleAttachClick(section.key)}
                                            disabled={uploading[section.key]}
                                            className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ArrowUpTrayIcon className="h-5 w-5" aria-hidden="true" />
                                            {uploading[section.key] ? 'Uploading...' : 'Attach'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                );
            })}
            <DeleteEvidenceModal
                evidenceToDelete={evidenceToDelete}
                setEvidenceToDelete={setEvidenceToDelete}
                setUploadedEvidence={setUploadedEvidence}
            />
        </div>
    );
};

export default RegulatoryFillingTab;