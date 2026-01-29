import React from 'react';
import { DocumentIcon, EyeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/shared/utils/dateUtils';

interface EvidenceCardProps {
    evidence: {
        id: string;
        fileName: string;
        fileSize?: number;
        mimeType?: string;
        evidenceType?: string;
        uploadedBy?: string;
        uploadedByName?: string;
        uploadedAt?: string;
        description?: string;
        hash?: string;
    } | string;
    viewingId: string | null;
    downloadingId: string | null;
    handleViewEvidence: (fileName: string, id: string) => void;
    handleDownloadEvidence: (id: string) => void;
    getAssigneeFullName: (id?: string) => string;
    formatFileSize: (size: number) => string;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
    evidence,
    viewingId,
    downloadingId,
    handleViewEvidence,
    handleDownloadEvidence,
    getAssigneeFullName,
    formatFileSize,
}) => {
    const evidenceId = typeof evidence === 'string' ? evidence : evidence.id;
    const evidenceName = typeof evidence === 'string' ? evidence : evidence.fileName;
    const evidenceObj = typeof evidence === 'object' ? evidence : null;

    return (
        <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="flex items-start gap-3">
                <DocumentIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm break-words">{evidenceName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        ID: <span className="font-mono">{evidenceId}</span>
                    </p>
                    {evidenceObj?.description && (
                        <p className="text-xs text-gray-600 mt-1">{evidenceObj.description}</p>
                    )}
                </div>

                <div className="flex gap-1 flex-shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewEvidence(evidenceName, evidenceId);
                        }}
                        disabled={viewingId === evidenceId || downloadingId === evidenceId}
                        className={`inline-flex items-center justify-center p-2 rounded transition-colors ${viewingId === evidenceId
                            ? 'text-blue-400 bg-blue-50 cursor-wait'
                            : downloadingId === evidenceId
                                ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                        title={viewingId === evidenceId ? 'Loading...' : 'View evidence'}
                    >
                        {viewingId === evidenceId ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <EyeIcon className="h-4 w-4" />
                        )}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadEvidence(evidenceId);
                        }}
                        disabled={downloadingId === evidenceId || viewingId === evidenceId}
                        className={`inline-flex items-center justify-center p-2 rounded transition-colors ${downloadingId === evidenceId
                            ? 'text-green-400 bg-green-50 cursor-wait'
                            : viewingId === evidenceId
                                ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                        title={downloadingId === evidenceId ? 'Downloading...' : 'Download evidence'}
                    >
                        {downloadingId === evidenceId ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <ArrowDownTrayIcon className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* Evidence Details */}
            {evidenceObj && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {evidenceObj.fileSize && (
                        <div>
                            <span className="text-gray-500 font-medium">Size:</span>
                            <span className="text-gray-700 ml-1">{formatFileSize(evidenceObj.fileSize)}</span>
                        </div>
                    )}
                    {evidenceObj.mimeType && (
                        <div>
                            <span className="text-gray-500 font-medium">Type:</span>
                            <span className="text-gray-700 ml-1">{evidenceObj.mimeType}</span>
                        </div>
                    )}
                    {evidenceObj.evidenceType && (
                        <div>
                            <span className="text-gray-500 font-medium">Category:</span>
                            <span className="text-gray-700 ml-1">{evidenceObj.evidenceType}</span>
                        </div>
                    )}
                    {evidenceObj.uploadedAt && (
                        <div>
                            <span className="text-gray-500 font-medium">Uploaded:</span>
                            <span className="text-gray-700 ml-1">{formatDate(evidenceObj.uploadedAt)}</span>
                        </div>
                    )}
                    {getAssigneeFullName(evidenceObj.uploadedBy) !== '' && (
                        <div className="col-span-2">
                            <span className="text-gray-500 font-medium">Uploaded By:</span>
                            <span className="text-gray-700 ml-1">{getAssigneeFullName(evidenceObj.uploadedBy)}</span>
                        </div>
                    )}
                    {evidenceObj.uploadedBy && !evidenceObj.uploadedByName && (
                        <div className="col-span-2">
                            <span className="text-gray-500 font-medium">Uploaded By (ID):</span>
                            <span className="text-gray-700 ml-1 font-mono">{evidenceObj.uploadedBy}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EvidenceCard;