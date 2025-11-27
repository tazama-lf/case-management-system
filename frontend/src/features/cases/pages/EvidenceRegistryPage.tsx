import React, { useState } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import {
  useSearchEvidence,
  useDownloadEvidence,
  useVerifyEvidence,
} from '../hooks/useEvidence';
import { evidenceService } from '../services/evidenceService';
import type {
  Evidence,
  EvidenceType,
  EvidenceSearchFilters,
} from '../../types/evidence.types';

const EvidenceRegistryPage: React.FC = () => {
  const [filters, setFilters] = useState<EvidenceSearchFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(
    null,
  );

  const { data: evidenceData, isLoading } = useSearchEvidence(
    { ...filters, search: searchQuery || undefined },
    page,
    20,
  );
  const downloadMutation = useDownloadEvidence();
  const verifyMutation = useVerifyEvidence(''); // No specific case ID for registry

  const evidence = evidenceData?.evidence || [];
  const pagination = evidenceData?.pagination;

  const handleVerify = (evidenceItem: Evidence) => {
    verifyMutation.mutate({
      evidence_id: evidenceItem.evidence_id,
      expected_hash: evidenceItem.file_hash,
    });
  };

  const handleDownload = (evidenceId: string) => {
    downloadMutation.mutate(evidenceId);
  };

  const getEvidenceIcon = (type: EvidenceType) => {
    switch (type) {
      case 'SCREENSHOT':
      case 'MEDIA':
        return '📷';
      case 'LOG_FILE':
        return '📝';
      case 'TRANSACTION_RECORD':
        return '💳';
      case 'COMMUNICATION':
        return '✉️';
      default:
        return '📄';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Evidence Registry
          </h1>
          <p className="text-gray-600 mt-1">
            Search and verify evidence across all cases
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by filename, description, tags, case ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline flex items-center gap-2 ${showFilters ? 'bg-blue-50' : ''}`}
          >
            <FunnelIcon className="h-4 w-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-4 gap-4 pt-4 border-t">
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
                Date From
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                className="input"
                value={filters.date_to || ''}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center p-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : evidence.length === 0 ? (
        <div className="card text-center py-12">
          <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No evidence found</p>
          <p className="text-sm text-gray-500 mt-2">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {evidence.map((item: Evidence) => (
            <div
              key={item.evidence_id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedEvidence(item)}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">
                  {getEvidenceIcon(item.evidence_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        {item.file_name}
                        {item.verified && (
                          <CheckCircleIcon
                            className="h-5 w-5 text-green-600"
                            title="Verified"
                          />
                        )}
                        {!item.verified && (
                          <ExclamationTriangleIcon
                            className="h-5 w-5 text-yellow-600"
                            title="Unverified"
                          />
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
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
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <FolderIcon className="h-4 w-4" />
                      Case: {item.case_id}
                    </span>
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
                    {item.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{item.tags.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-400 font-mono">
                    Hash: {item.file_hash.substring(0, 32)}...
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between card">
          <p className="text-sm text-gray-600">
            Showing {evidence.length} of {pagination.total} evidence items
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              className="btn-outline"
              disabled={pagination.page === 1}
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              className="btn-outline"
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </button>
          </div>
        </div>
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

// Evidence Details Modal
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
              className="text-gray-400 hover:text-gray-600 text-2xl"
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
                <p className="text-sm font-medium text-gray-500">Case ID</p>
                <p className="text-gray-900 font-mono">{evidence.case_id}</p>
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
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    evidence.access_level === 'PUBLIC'
                      ? 'bg-green-100 text-green-800'
                      : evidence.access_level === 'CONFIDENTIAL'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {evidence.access_level}
                </span>
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
                {evidence.tags.length > 0 ? (
                  evidence.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No tags</span>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Integrity Information
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">SHA-256 Hash</p>
                  <p className="text-xs font-mono text-gray-900 break-all bg-white p-2 rounded border">
                    {evidence.file_hash}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {evidence.verified ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircleIcon className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Verified</p>
                        <p className="text-xs text-gray-600">
                          {new Date(
                            evidence.verification_date!,
                          ).toLocaleString()}
                          {evidence.verified_by &&
                            ` by ${evidence.verified_by}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-600 text-sm">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      <p className="font-medium">Not yet verified</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {evidence.metadata && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Metadata
                </p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(evidence.metadata).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-blue-700 font-medium">{key}:</dt>
                      <dd className="text-blue-900">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onVerify}
              className="btn-outline flex items-center gap-2"
            >
              <ShieldCheckIcon className="h-4 w-4" />
              Verify Integrity
            </button>
            <button
              onClick={onDownload}
              className="btn-primary flex items-center gap-2"
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

export default EvidenceRegistryPage;
