/**
 * Sanctions Screening Tab Component
 * Manages sanctions screening reports for investigations
 */

import React, { useState } from 'react';
import {
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  ArrowUpIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import {
  useCaseSanctionsScreenings,
  useCreateSanctionsScreening,
  useDeleteSanctionsScreening,
  useDownloadSanctionsReport,
  useCaseSanctionsStatistics,
} from '../../hooks/useSanctionsScreening';
import type {
  SanctionsScreening,
  SanctionsScreeningFormData,
  SanctionsDisposition,
} from '../../types/sanctions.types';
import {
  SANCTIONS_TOOLS,
  DISPOSITION_OPTIONS,
} from '../../types/sanctions.types';
import {
  validateScreeningFile,
  formatFileSize,
  getDispositionColor,
} from '../../services/sanctionsService';

interface SanctionsScreeningTabProps {
  caseId: string;
}

const SanctionsScreeningTab: React.FC<SanctionsScreeningTabProps> = ({
  caseId,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedScreening, setSelectedScreening] =
    useState<SanctionsScreening | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState<
    SanctionsDisposition | ''
  >('');
  const [toolFilter, setToolFilter] = useState<string>('');

  // Fetch data
  const { data: screeningsData, isLoading } = useCaseSanctionsScreenings(
    caseId,
    {
      disposition: dispositionFilter ||undefined,
      tool_source: toolFilter ?? undefined,
      search: searchQuery ?? undefined,
    },
  );

  const { data: statistics } = useCaseSanctionsStatistics(caseId);

  const screenings = screeningsData?.screenings ?? [];

  // View details
  const handleViewDetails = (screening: SanctionsScreening) => {
    setSelectedScreening(screening);
    setShowDetailsModal(true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDispositionFilter('');
    setToolFilter('');
  };

  const hasActiveFilters = searchQuery ?? dispositionFilter ?? toolFilter;

  return (
    <div className="space-y-4">
      {/* Header with Statistics */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Sanctions Screening
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track sanctions screening reports from external tools
          </p>
          {statistics && (
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-gray-600">
                Total:{' '}
                <span className="font-medium">
                  {statistics.total_screenings}
                </span>
              </span>
              {statistics.high_risk_count > 0 && (
                <span className="text-red-600">
                  High Risk:{' '}
                  <span className="font-medium">
                    {statistics.high_risk_count}
                  </span>
                </span>
              )}
              {statistics.pending_review_count > 0 && (
                <span className="text-blue-600">
                  Pending:{' '}
                  <span className="font-medium">
                    {statistics.pending_review_count}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setShowUploadModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <PlusIcon className="h-4 w-4" />
          Upload Screening
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search screenings..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setShowFilters(!showFilters);
          }}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            showFilters
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FunnelIcon className="h-4 w-4" />
          Filters
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disposition
              </label>
              <select
                value={dispositionFilter}
                onChange={(e) => {
                  setDispositionFilter(
                    e.target.value as SanctionsDisposition | '',
                  );
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Dispositions</option>
                {DISPOSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tool/Source
              </label>
              <select
                value={toolFilter}
                onChange={(e) => {
                  setToolFilter(e.target.value);
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Tools</option>
                {SANCTIONS_TOOLS.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Screenings List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-500">Loading screenings...</p>
          </div>
        ) : screenings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No Sanctions Screenings
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by uploading your first sanctions screening report.
            </p>
            <button
              onClick={() => {
                setShowUploadModal(true);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <PlusIcon className="h-4 w-4" />
              Upload First Screening
            </button>
          </div>
        ) : (
          screenings.map((screening) => (
            <ScreeningCard
              key={screening.screening_id}
              screening={screening}
              onViewDetails={handleViewDetails}
            />
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadScreeningModal
          caseId={caseId}
          onClose={() => {
            setShowUploadModal(false);
          }}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedScreening && (
        <ScreeningDetailsModal
          screening={selectedScreening}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedScreening(null);
          }}
        />
      )}
    </div>
  );
};

// Screening Card Component
interface ScreeningCardProps {
  screening: SanctionsScreening;
  onViewDetails: (screening: SanctionsScreening) => void;
}

const ScreeningCard: React.FC<ScreeningCardProps> = ({
  screening,
  onViewDetails,
}) => {
  const dispositionConfig = DISPOSITION_OPTIONS.find(
    (d) => d.value === screening.disposition,
  );
  const colorClass = getDispositionColor(screening.disposition);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-${colorClass}-100 text-${colorClass}-800`}
            >
              <span className="text-base">{dispositionConfig?.icon}</span>
              {dispositionConfig?.label ?? screening.disposition}
            </span>
            <span className="text-sm text-gray-500">
              <CalendarIcon className="inline h-4 w-4 mr-1" />
              {format(new Date(screening.screening_date), 'MMM d, yyyy')}
            </span>
          </div>

          <h4 className="text-sm font-medium text-gray-900 mb-1">
            {screening.tool_source}
            {screening.reference_id && (
              <span className="ml-2 text-xs text-gray-500">
                Ref: {screening.reference_id}
              </span>
            )}
          </h4>

          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {screening.summary}
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              Matches:{' '}
              <span className="font-medium text-gray-900">
                {screening.match_count ?? 0}
              </span>
            </span>
            {screening.file_name && (
              <span className="flex items-center gap-1">
                <DocumentTextIcon className="h-4 w-4" />
                {screening.file_name}
              </span>
            )}
            <span>
              By: {screening.investigator_name ?? screening.investigator_id}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            onViewDetails(screening);
          }}
          className="ml-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View Details →
        </button>
      </div>
    </div>
  );
};

// Upload Modal Component
interface UploadScreeningModalProps {
  caseId: string;
  onClose: () => void;
}

const UploadScreeningModal: React.FC<UploadScreeningModalProps> = ({
  caseId,
  onClose,
}) => {
  const [formData, setFormData] = useState<SanctionsScreeningFormData>({
    screening_date: format(new Date(), 'yyyy-MM-dd'),
    tool_source: '',
    reference_id: '',
    disposition: 'PENDING_REVIEW',
    match_count: 0,
    summary: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');

  const createMutation = useCreateSanctionsScreening();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateScreeningFile(selectedFile);
    if (!validation.valid) {
      setFileError(validation.error ?? 'Invalid file');
      setFile(null);
      return;
    }

    setFileError('');
    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tool_source || !formData.summary) {
      setFileError('Please fill in all required fields');
      return;
    }

    try {
      await createMutation.mutateAsync({
        case_id: caseId,
        screening_date: formData.screening_date,
        tool_source: formData.tool_source,
        disposition: formData.disposition,
        summary: formData.summary,
        reference_id: formData.reference_id ?? undefined,
        match_count: formData.match_count,
        file: file ?? undefined,
        metadata:
          formData.entities_screened ?? formData.confidence_score ??
          formData.risk_level
            ? {
                entities_screened: formData.entities_screened,
                confidence_score: formData.confidence_score,
                risk_level: formData.risk_level,
                watchlists_checked: formData.watchlists_checked
                  ? formData.watchlists_checked.split(',').map((w) => w.trim())
                  : undefined,
              }
            : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Upload Sanctions Screening
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report File <span className="text-gray-400">(Optional)</span>
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500">
                    <span>Upload a file</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={handleFileChange}
                      accept=".pdf,.xlsx,.xls,.csv,.json,.txt"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PDF, Excel, CSV, JSON up to 50MB
                </p>
                {file && (
                  <p className="text-sm font-medium text-green-600 mt-2">
                    ✓ {file.name} ({formatFileSize(file.size)})
                  </p>
                )}
                {fileError && (
                  <p className="text-sm text-red-600 mt-2">{fileError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Screening Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screening Date *
            </label>
            <input
              type="date"
              required
              value={formData.screening_date}
              onChange={(e) => {
                setFormData({ ...formData, screening_date: e.target.value });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Tool/Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tool/Source *
            </label>
            <select
              required
              value={formData.tool_source}
              onChange={(e) => {
                setFormData({ ...formData, tool_source: e.target.value });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select a tool...</option>
              {SANCTIONS_TOOLS.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
          </div>

          {/* Reference ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference ID <span className="text-gray-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.reference_id}
              onChange={(e) => {
                setFormData({ ...formData, reference_id: e.target.value });
              }}
              placeholder="External system reference"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Disposition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disposition *
            </label>
            <select
              required
              value={formData.disposition}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  disposition: e.target.value as SanctionsDisposition,
                });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {DISPOSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Match Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Matches
            </label>
            <input
              type="number"
              min="0"
              value={formData.match_count}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  match_count: parseInt(e.target.value) || 0,
                });
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary *
            </label>
            <textarea
              required
              rows={4}
              value={formData.summary}
              onChange={(e) => {
                setFormData({ ...formData, summary: e.target.value });
              }}
              placeholder="Summarize the screening results and findings..."
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Advanced Metadata (Collapsible) */}
          <details className="border border-gray-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
              Advanced Metadata (Optional)
            </summary>
            <div className="p-4 space-y-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entities Screened
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.entities_screened ?? ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        entities_screened:
                          parseInt(e.target.value) || undefined,
                      });
                    }}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Score (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.confidence_score ?? ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        confidence_score:
                          parseFloat(e.target.value) || undefined,
                      });
                    }}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Level
                </label>
                <select
                  value={formData.risk_level ?? ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      risk_level:
                        (e.target.value as
                          | 'LOW'
                          | 'MEDIUM'
                          | 'HIGH'
                          | 'CRITICAL') || undefined,
                    });
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Watchlists Checked (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.watchlists_checked ?? ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      watchlists_checked: e.target.value,
                    });
                  }}
                  placeholder="OFAC, EU, UN, etc."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </details>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <ArrowUpIcon className="h-4 w-4" />
                  Upload Screening
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Details Modal Component
interface ScreeningDetailsModalProps {
  screening: SanctionsScreening;
  onClose: () => void;
}

const ScreeningDetailsModal: React.FC<ScreeningDetailsModalProps> = ({
  screening,
  onClose,
}) => {
  const downloadMutation = useDownloadSanctionsReport();
  const deleteMutation = useDeleteSanctionsScreening();

  const dispositionConfig = DISPOSITION_OPTIONS.find(
    (d) => d.value === screening.disposition,
  );
  const colorClass = getDispositionColor(screening.disposition);

  const handleDownload = async () => {
    if (screening.evidence_id) {
      await downloadMutation.mutateAsync(screening.screening_id);
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete this sanctions screening? This action cannot be undone.',
      )
    ) {
      await deleteMutation.mutateAsync(screening.screening_id);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Sanctions Screening Details
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Disposition Badge */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-${colorClass}-100 text-${colorClass}-800`}
            >
              <span className="text-xl">{dispositionConfig?.icon}</span>
              {dispositionConfig?.label ?? screening.disposition}
            </span>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ClockIcon className="h-4 w-4" />
              Uploaded {format(new Date(screening.uploaded_at), 'PPp')}
            </div>
          </div>

          {/* Main Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Screening Date
              </p>
              <p className="text-base text-gray-900">
                {format(new Date(screening.screening_date), 'MMMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Tool/Source
              </p>
              <p className="text-base text-gray-900">{screening.tool_source}</p>
            </div>
            {screening.reference_id && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Reference ID
                </p>
                <p className="text-base text-gray-900 font-mono">
                  {screening.reference_id}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Number of Matches
              </p>
              <p className="text-base text-gray-900">
                {screening.match_count ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Investigator
              </p>
              <p className="text-base text-gray-900">
                {screening.investigator_name ?? screening.investigator_id}
              </p>
            </div>
            {screening.file_name && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Report File
                </p>
                <p className="text-base text-gray-900 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                  {screening.file_name}
                  {screening.file_size && (
                    <span className="text-sm text-gray-500">
                      ({formatFileSize(screening.file_size)})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Summary</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
              {screening.summary}
            </p>
          </div>

          {/* Metadata */}
          {screening.metadata && Object.keys(screening.metadata).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5" />
                Additional Metadata
              </p>
              <dl className="grid grid-cols-2 gap-4">
                {screening.metadata.entities_screened && (
                  <div>
                    <dt className="text-xs text-gray-500">Entities Screened</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {screening.metadata.entities_screened}
                    </dd>
                  </div>
                )}
                {screening.metadata.confidence_score && (
                  <div>
                    <dt className="text-xs text-gray-500">Confidence Score</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {screening.metadata.confidence_score}%
                    </dd>
                  </div>
                )}
                {screening.metadata.risk_level && (
                  <div>
                    <dt className="text-xs text-gray-500">Risk Level</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {screening.metadata.risk_level}
                    </dd>
                  </div>
                )}
                {screening.metadata.watchlists_checked &&
                  Array.isArray(screening.metadata.watchlists_checked) && (
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-500 mb-2">
                        Watchlists Checked
                      </dt>
                      <dd className="flex flex-wrap gap-2">
                        {screening.metadata.watchlists_checked.map(
                          (list: string) => (
                            <span
                              key={list}
                              className="px-2 py-1 bg-white text-xs font-medium text-gray-700 rounded border border-gray-200"
                            >
                              {list}
                            </span>
                          ),
                        )}
                      </dd>
                    </div>
                  )}
              </dl>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
            <div className="flex gap-3">
              {screening.evidence_id && (
                <button
                  onClick={handleDownload}
                  disabled={downloadMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  {downloadMutation.isPending
                    ? 'Downloading...'
                    : 'Download Report'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SanctionsScreeningTab;
