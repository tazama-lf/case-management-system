import React, { useState, useRef } from 'react';
import {
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentIcon,
  PhotoIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import {
  useCaseEvidence,
  useUploadEvidence,
  useVerifyEvidence,
  useDeleteEvidence,
  useDownloadEvidence,
} from '../../hooks/useEvidence';
import { evidenceService } from '../../services/evidenceService';
import type {
  Evidence,
  EvidenceType,
  EvidenceSearchFilters,
} from '../../types/evidence.types';
import toast from 'react-hot-toast';

interface EvidenceDocumentsTabProps {
  caseId: string;
}

const EvidenceDocumentsTab: React.FC<EvidenceDocumentsTabProps> = ({
  caseId,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<EvidenceSearchFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(
    null,
  );

  const {
    data: evidenceData,
    isLoading,
    refetch,
  } = useCaseEvidence(caseId, filters);
  const uploadMutation = useUploadEvidence(caseId);
  const verifyMutation = useVerifyEvidence(caseId);
  const deleteMutation = useDeleteEvidence(caseId);
  const downloadMutation = useDownloadEvidence();

  const evidence = evidenceData?.evidence || [];
  const pagination = evidenceData?.pagination;

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    refetch();
  };

  const handleVerify = async (evidenceItem: Evidence) => {
    verifyMutation.mutate({
      evidence_id: evidenceItem.evidence_id,
      expected_hash: evidenceItem.file_hash,
    });
  };

  const handleDownload = (evidenceId: string) => {
    downloadMutation.mutate(evidenceId);
  };

  const handleDelete = (evidenceId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this evidence? This action will be logged.',
      )
    ) {
      deleteMutation.mutate({ evidenceId, reason: 'User requested deletion' });
    }
  };

  const getEvidenceIcon = (type: EvidenceType) => {
    switch (type) {
      case 'SCREENSHOT':
      case 'MEDIA':
        return PhotoIcon;
      case 'LOG_FILE':
        return DocumentTextIcon;
      default:
        return DocumentIcon;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Upload and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              showFilters
                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Filters
          </button>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
          Upload Evidence
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evidence Type
              </label>
              <select
                className="input"
                value={filters.evidence_type || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    evidence_type:
                      (e.target.value as EvidenceType) || undefined,
                  })
                }
              >
                <option value="">All Types</option>
                <option value="DOCUMENT">Document</option>
                <option value="SCREENSHOT">Screenshot</option>
                <option value="LOG_FILE">Log File</option>
                <option value="TRANSACTION_RECORD">Transaction Record</option>
                <option value="COMMUNICATION">Communication</option>
                <option value="MEDIA">Media</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification Status
              </label>
              <select
                className="input"
                value={
                  filters.verified === undefined
                    ? ''
                    : filters.verified.toString()
                }
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    verified:
                      e.target.value === ''
                        ? undefined
                        : e.target.value === 'true',
                  })
                }
              >
                <option value="">All</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <input
                type="date"
                className="input"
                value={filters.date_from || ''}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Evidence List */}
      {evidence.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <DocumentIcon className="h-12 w-12 text-gray-400" />
            <p className="text-gray-600 font-medium">
              No evidence uploaded yet
            </p>
            <p className="text-sm text-gray-500">
              Upload documents, screenshots, logs, or other evidence to get
              started
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Upload First Evidence
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {evidence.map((item) => {
            const Icon = getEvidenceIcon(item.evidence_type);
            return (
              <div
                key={item.evidence_id}
                className="card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedEvidence(item)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Icon className="h-10 w-10 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          {item.file_name}
                          {item.verified && (
                            <CheckCircleIcon
                              className="h-5 w-5 text-green-600"
                              title="Verified"
                            />
                          )}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerify(item);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Verify Integrity"
                          disabled={verifyMutation.isPending}
                        >
                          <ShieldCheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item.evidence_id);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                          title="Download"
                          disabled={downloadMutation.isPending}
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.evidence_id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                          disabled={deleteMutation.isPending}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        {item.uploader_name || item.uploader_id}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {formatDate(item.uploaded_at)}
                      </span>
                      <span>
                        {evidenceService.formatFileSize(item.file_size)}
                      </span>
                      <span className="badge-priority-low">
                        {item.evidence_type}
                      </span>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-400 font-mono">
                      SHA-256: {item.file_hash.substring(0, 16)}...
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-gray-600">
            Showing {evidence.length} of {pagination.total} evidence items
          </p>
          <div className="flex gap-2">
            <button className="btn-outline" disabled={pagination.page === 1}>
              Previous
            </button>
            <button
              className="btn-outline"
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadEvidenceModal
          caseId={caseId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
          uploadMutation={uploadMutation}
        />
      )}

      {/* Evidence Details Modal */}
      {selectedEvidence && (
        <EvidenceDetailsModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
          onVerify={() => handleVerify(selectedEvidence)}
          onDownload={() => handleDownload(selectedEvidence.evidence_id)}
        />
      )}
    </div>
  );
};

// Upload Modal Component
interface UploadEvidenceModalProps {
  caseId: string;
  onClose: () => void;
  onSuccess: () => void;
  uploadMutation: ReturnType<typeof useUploadEvidence>;
}

const UploadEvidenceModal: React.FC<UploadEvidenceModalProps> = ({
  caseId,
  onClose,
  onSuccess,
  uploadMutation,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('DOCUMENT');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState('');
  const [accessLevel, setAccessLevel] = useState<
    'PUBLIC' | 'CONFIDENTIAL' | 'RESTRICTED'
  >('CONFIDENTIAL');
  const [calculatingHash, setCalculatingHash] = useState(false);
  const [fileHash, setFileHash] = useState<string>('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = evidenceService.validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);

    // Calculate hash
    setCalculatingHash(true);
    try {
      const hash = await evidenceService.calculateFileHash(file);
      setFileHash(hash);
      toast.success('File hash calculated for integrity verification');
    } catch {
      toast.error('Failed to calculate file hash');
    } finally {
      setCalculatingHash(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        case_id: caseId,
        tags,
        evidence_type: evidenceType,
        description: description || undefined,
        access_level: accessLevel,
        metadata: {
          original_name: selectedFile.name,
          mime_type: selectedFile.type,
        },
      });
      onSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Upload Evidence
          </h3>

          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <DocumentIcon className="h-12 w-12 text-blue-600 mx-auto" />
                  <p className="font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {evidenceService.formatFileSize(selectedFile.size)}
                  </p>
                  {calculatingHash && (
                    <p className="text-xs text-blue-600">
                      Calculating integrity hash...
                    </p>
                  )}
                  {fileHash && (
                    <p className="text-xs text-green-600 font-mono">
                      Hash: {fileHash.substring(0, 16)}...
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-600">
                    Click to select or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    Max 50MB • PDF, Images, Documents, Logs
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Evidence Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence Type
            </label>
            <select
              className="input"
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
            >
              <option value="DOCUMENT">Document</option>
              <option value="SCREENSHOT">Screenshot</option>
              <option value="LOG_FILE">Log File</option>
              <option value="TRANSACTION_RECORD">Transaction Record</option>
              <option value="COMMUNICATION">Communication</option>
              <option value="MEDIA">Media</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Describe the evidence and its relevance to the case..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <button
                onClick={handleAddTag}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Access Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Level
            </label>
            <select
              className="input"
              value={accessLevel}
              onChange={(e) =>
                setAccessLevel(e.target.value as typeof accessLevel)
              }
            >
              <option value="PUBLIC">Public</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="RESTRICTED">Restricted</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploadMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !selectedFile || uploadMutation.isPending || calculatingHash
              }
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Upload Evidence
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Evidence Details Modal Component
interface EvidenceDetailsModalProps {
  evidence: Evidence;
  onClose: () => void;
  onVerify: () => void;
  onDownload: () => void;
}

const EvidenceDetailsModal: React.FC<EvidenceDetailsModalProps> = ({
  evidence,
  onClose,
  onVerify,
  onDownload,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Evidence Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">File Name</p>
                <p className="text-gray-900">{evidence.file_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Evidence Type
                </p>
                <p className="text-gray-900">{evidence.evidence_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">File Size</p>
                <p className="text-gray-900">
                  {evidenceService.formatFileSize(evidence.file_size)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Uploaded By</p>
                <p className="text-gray-900">
                  {evidence.uploader_name || evidence.uploader_id}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Upload Date</p>
                <p className="text-gray-900">
                  {new Date(evidence.uploaded_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Access Level
                </p>
                <p className="text-gray-900">{evidence.access_level}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Description
              </p>
              <p className="text-gray-900">
                {evidence.description || 'No description provided'}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {evidence.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Integrity Information
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">SHA-256 Hash</p>
                  <p className="text-xs font-mono text-gray-900 break-all">
                    {evidence.file_hash}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {evidence.verified ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircleIcon className="h-5 w-5" />
                      Verified on{' '}
                      {new Date(evidence.verification_date!).toLocaleString()}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600 text-sm">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      Not yet verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onVerify}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <ShieldCheckIcon className="h-4 w-4" />
              Verify Integrity
            </button>
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceDocumentsTab;
