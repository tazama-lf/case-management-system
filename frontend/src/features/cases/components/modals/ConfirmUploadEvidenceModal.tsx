// ConfirmUploadEvidenceModal.tsx
import React from 'react';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';

interface SectionFilePreview {
    sectionTitle: string;
    files: File[];
}

interface ConfirmUploadEvidenceModalProps {
    isOpen: boolean;
    isUploading: boolean;
    sections: SectionFilePreview[];
    onCancel: () => void;
    onConfirm: () => Promise<void>;
}

const ConfirmUploadEvidenceModal: React.FC<ConfirmUploadEvidenceModalProps> = ({
    isOpen,
    isUploading,
    sections,
    onCancel,
    onConfirm,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
                <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <ArrowUpCircleIcon className="h-6 w-6 text-green-600" />
                    </span>
                    Confirm Evidence Upload
                </h3>

                <p className="mt-3 text-sm text-gray-600">
                    The following evidence files will be uploaded:
                </p>

                {/* Section + file list */}
                <div className="mt-4 max-h-64 space-y-4 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3">
                    {sections.map(section => (
                        <div key={section.sectionTitle}>
                            <p className="text-sm font-semibold text-gray-800">
                                {section.sectionTitle}
                            </p>

                            <ul className="mt-1 space-y-1 text-sm text-gray-700">
                                {section.files.map((file, index) => (
                                    <li key={`${file.name}-${index}`} className="truncate">
                                        • {file.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isUploading}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={onConfirm}
                        disabled={isUploading}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        {isUploading ? 'Uploading…' : 'Confirm Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmUploadEvidenceModal;
