import React, { useState, Suspense } from 'react';
import {
  ExclamationCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import EvidenceFindingsStatsCards from '@/features/reports/components/EvidenceFindingsStatsCards';
import { useEvidenceFindings } from '@/features/reports/hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '@/shared/utils/exportUtils';
import { usePagination } from '@/shared/hooks/usePagination';
import type { FindingDetail } from '@/features/reports/types/reports.types';

const PaginationControls = React.lazy(
  () => import('@/shared/components/PaginationControls'),
);

interface EvidenceFindingsReportProps {
  dateRange?:
    | 'today'
    | 'yesterday'
    | 'last7'
    | 'last30'
    | 'last90'
    | 'thisMonth'
    | 'lastYear';
}

const EvidenceFindingsReport: React.FC<EvidenceFindingsReportProps> = ({
  dateRange = 'last30',
}) => {
  const {
    data: evidenceData,
    isLoading,
    error,
  } = useEvidenceFindings(dateRange);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Confirmed' | 'Refuted' | 'Inconclusive'
  >('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    filename: string;
    description: string;
    evidenceId: string;
    fileSize?: string;
    uploadedAt?: string;
    contentUrl?: string;
  }>({ isOpen: false, filename: '', description: '', evidenceId: '' });

  // Use real data from API
  const displayData = evidenceData;

  const handleExportExcel = () => {
    try {
      const data = filteredFindings;
      const formattedData = formatDataForExport(data, 'EVIDENCE_FINDINGS');
      const filename = `evidence-findings-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Evidence Findings Report');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const data = filteredFindings;
      const formattedData = formatDataForExport(data, 'EVIDENCE_FINDINGS');
      const filename = `evidence-findings-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const data = filteredFindings;
      const formattedData = formatDataForExport(data, 'EVIDENCE_FINDINGS');
      const filename = `evidence-findings-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport('EVIDENCE_FINDINGS');
      await exportToPDF(
        formattedData,
        filename,
        'Evidence Findings Report',
        columns,
      );
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const handleViewEvidence = (filename: string, evidenceId: string = '') => {
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const actualEvidenceId = evidenceId || filename;
      
      console.log('[Evidence View] Starting view for:', { actualEvidenceId, filename, hasToken: !!token });
      
      if (!token) {
        console.warn('[Evidence View] No auth token found');
        alert('Authentication token not found. Please log in again.');
        return;
      }
      
      // Fetch metadata from API
      fetch(`/api/v1/evidence/${actualEvidenceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
        .then((response) => {
          console.log('[Evidence View] Response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log('[Evidence View] Metadata received:', data);
          
          // Extract real filename
          const realFileName = data.fileName || data.file_name || filename;
          const fileExtension = realFileName.split('.').pop()?.toLowerCase() || 'unknown';
          const mimeType = data.mimeType || data.mime_type || 'application/octet-stream';
          
          // Get file size
          const fileSizeBytes = data.fileSize || data.file_size || 0;
          const fileSize = fileSizeBytes 
            ? `${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB` 
            : 'Unknown';
          
          // Get upload date
          const uploadedAt = (data.uploadedAt || data.uploaded_at)
            ? new Date(data.uploadedAt || data.uploaded_at).toLocaleString('en-GB')
            : 'Unknown';
          
          // Get evidence type
          const evidenceType = data.evidenceType || data.mimeType || 'Document';
          
          // Create preview URL
          const contentUrl = `/api/v1/evidence/${actualEvidenceId}/download`;
          
          console.log('[Evidence View] Setting modal with:', { fileExtension, mimeType, fileSize });
          
          setModalState({
            isOpen: true,
            filename: realFileName,
            description: evidenceType,
            evidenceId: actualEvidenceId,
            fileSize,
            uploadedAt,
            contentUrl,
          });
        })
        .catch((err) => {
          console.error('[Evidence View] Error fetching metadata:', err);
          alert(`Failed to fetch evidence metadata: ${err.message}`);
        });
    } catch (err) {
      console.error('[Evidence View] Error:', err);
      alert(`Failed to view document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDownloadEvidence = (evidenceId: string) => {
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const url = `/api/v1/evidence/${evidenceId}/download`;
      
      console.log('[Evidence Download] Starting download:', { evidenceId, hasToken: !!token });
      
      if (!token) {
        console.warn('[Evidence Download] No auth token found');
        alert('Authentication token not found. Please log in again.');
        return;
      }
      
      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then((response) => {
          console.log('[Evidence Download] Response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          // Get filename from response headers - backend provides this
          const contentDisposition = response.headers.get('content-disposition');
          let downloadFilename = 'evidence';
          
          if (contentDisposition) {
            // Extract filename from: attachment; filename="real-filename.pdf"
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              downloadFilename = filenameMatch[1];
            }
          }
          
          console.log('[Evidence Download] Filename from headers:', downloadFilename);
          
          return response.blob().then(blob => {
            if (blob.size === 0) {
              throw new Error('Received empty file from server');
            }
            console.log('[Evidence Download] Blob received, size:', blob.size);
            return { blob, downloadFilename };
          });
        })
        .then(({ blob, downloadFilename }) => {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = downloadFilename;
          link.setAttribute('style', 'display: none');
          document.body.appendChild(link);
          
          console.log('[Evidence Download] Triggering download:', downloadFilename);
          link.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            console.log('[Evidence Download] Download completed and cleaned up');
          }, 100);
        })
        .catch((err) => {
          console.error('[Evidence Download] Download failed:', err);
          alert(`Failed to download file: ${err.message}`);
        });
    } catch (err) {
      console.error('[Evidence Download] Error:', err);
      alert(`Download error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const closeModal = () => {
    setModalState({ isOpen: false, filename: '', description: '', evidenceId: '' });
  };

  const {
    stats = {
      totalFindings: 0,
      evidenceItems: 0,
      confirmedFindings: 0,
      refutedFindings: 0,
    },
    findings = [],
  } = displayData || {};

  // Filter findings based on search and status
  const filteredFindings = (findings || []).filter((finding: FindingDetail) => {
    const matchesSearch =
      finding.finding.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.caseId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' || finding.conclusion === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Add pagination
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedData: paginatedFindings,
    setCurrentPage,
    setItemsPerPage,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
    pageRange,
  } = usePagination({
    data: filteredFindings,
    defaultItemsPerPage: 10,
  });

  const getStatusColor = (conclusion: string) => {
    switch (conclusion) {
      case 'Confirmed':
        return 'bg-green-100 text-green-700 ring-1 ring-green-300';
      case 'Refuted':
        return 'bg-red-100 text-red-700 ring-1 ring-red-300';
      case 'Inconclusive':
        return 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 ring-1 ring-gray-300';
    }
  };

  // Helper to generate unique ID for each finding
  const getUniqueFindingId = (caseId: string, finding: string) => {
    return `${caseId}-${finding}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-2xl">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Evidence Findings Report
            </h1>
            <p className="mt-2 text-gray-600">
              Comprehensive view of all evidence items linked to investigation
              findings and conclusions
            </p>
          </div>
          <div className="pb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                {/* Loading skeleton for stats cards */}
                <div className="grid grid-cols-4 gap-8 mb-8 animate-pulse">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
                  ))}
                </div>

                {/* Loading skeleton for findings container */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
                  <div className="px-8 py-5 border-b border-gray-200">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2 p-8">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-2xl">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Evidence Findings Report
            </h1>
            <p className="mt-2 text-gray-600">
              Comprehensive view of all evidence items linked to investigation
              findings and conclusions
            </p>
          </div>
          <div className="pb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">
                  Failed to load evidence findings data. Please try again.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-2xl">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Evidence Findings Report
              </h1>
              <p className="mt-2 text-gray-600">
                Comprehensive view of all evidence items linked to investigation
                findings and conclusions
              </p>
            </div>
          </div>
        </div>
        <div className="pb-6">
          <div className="flex gap-4">
            {/* Main Content - Same width as filter section */}
            <div className="flex-1">
              {/* Stats Cards */}
              <EvidenceFindingsStatsCards stats={stats} />

              {/* Findings Container - Wrapped in inner container for alignment */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
                {/* Header with Title and Export Options */}
                <div className="px-8 py-5 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Investigation Findings
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Export to Excel
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Export as CSV
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Export as PDF
                      </button>
                    </div>
                  </div>

                  {/* Search and Filter Section */}
                  <div className="flex gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search findings, cases, or conclusions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Confirmed' | 'Refuted' | 'Inconclusive')}
                        className="appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-3 pr-8 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Refuted">Refuted</option>
                        <option value="Inconclusive">Inconclusive</option>
                      </select>
                      <FunnelIcon className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Results Info */}
                <div className="px-8 py-3 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm text-gray-600">
                    Showing{' '}
                    <span className="font-semibold">
                      {paginatedFindings.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold">
                      {filteredFindings.length}
                    </span>{' '}
                    findings (Page{' '}
                    <span className="font-semibold">{currentPage}</span> of{' '}
                    <span className="font-semibold">{totalPages}</span>)
                  </p>
                </div>

                {/* Findings List */}
                <div className="divide-y divide-gray-200">
                  {paginatedFindings.length > 0 ? (
                    paginatedFindings.map((finding) => {
                      const uniqueId = getUniqueFindingId(
                        finding.caseId,
                        finding.finding,
                      );
                      const isExpanded = expandedId === uniqueId;
                      return (
                        <div
                          key={uniqueId}
                          className="p-8 hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Finding Header */}
                          <div
                            className="cursor-pointer flex items-start justify-between group hover:opacity-100 opacity-95 transition-opacity"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : uniqueId)
                            }
                          >
                            <div className="flex-1">
                              <div className="flex items-start gap-3 mb-2">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {finding.finding}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Task:{' '}
                                    <span className="font-mono">
                                      {finding.taskId || finding.caseId}
                                    </span>{' '}
                                    | Date:{' '}
                                    <span className="font-mono">
                                      {new Date(
                                        finding.dateIdentified,
                                      ).toLocaleDateString('en-GB')}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(finding.conclusion)}`}
                                >
                                  {finding.conclusion}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                  {finding.evidenceCount} evidence items
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                              <div className="text-sm text-gray-600 mb-4">
                                <p>
                                  <strong>Conclusion:</strong>{' '}
                                  {finding.conclusion}
                                </p>
                              </div>
                              <div>
                                <h5 className="text-sm font-semibold text-gray-900 mb-3">
                                  Supporting Evidence
                                </h5>
                                <div className="space-y-3">
                                  {finding.supportingEvidence.map(
                                    (evidence: string | {
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
                                    }, idx: number) => {
                                     
                                      const evidenceId = typeof evidence === 'string' ? evidence : evidence.id;
                                      const evidenceName = typeof evidence === 'string' ? evidence : evidence.fileName;
                                      const evidenceObj = typeof evidence === 'object' ? evidence : null;
                                      
                                      return (
                                        <div
                                          key={idx}
                                          className="flex flex-col gap-3 p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                                        >
                                          <div className="flex items-start gap-3">
                                            <DocumentIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-gray-900 text-sm break-words">
                                                {evidenceName}
                                              </p>
                                              <p className="text-xs text-gray-500 mt-1">
                                                ID: <span className="font-mono">{evidenceId}</span>
                                              </p>
                                              {evidenceObj?.description && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                  {evidenceObj.description}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleViewEvidence(evidenceName, evidenceId);
                                                }}
                                                className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="View evidence"
                                              >
                                                <EyeIcon className="h-4 w-4" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDownloadEvidence(evidenceId);
                                                }}
                                                className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                                title="Download evidence"
                                              >
                                                <ArrowDownTrayIcon className="h-4 w-4" />
                                              </button>
                                            </div>
                                          </div>
                                          
                                          {/* Evidence details grid */}
                                          {evidenceObj && (
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              {evidenceObj.fileSize && (
                                                <div>
                                                  <span className="text-gray-500 font-medium">Size:</span>
                                                  <span className="text-gray-700 ml-1">
                                                    {(evidenceObj.fileSize / 1024 / 1024).toFixed(2)} MB
                                                  </span>
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
                                                  <span className="text-gray-700 ml-1">
                                                    {new Date(evidenceObj.uploadedAt).toLocaleDateString()}
                                                  </span>
                                                </div>
                                              )}
                                              {evidenceObj.uploadedByName && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500 font-medium">Uploaded By:</span>
                                                  <span className="text-gray-700 ml-1">{evidenceObj.uploadedByName}</span>
                                                </div>
                                              )}
                                              {evidenceObj.uploadedBy && !evidenceObj.uploadedByName && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500 font-medium">Uploaded By (ID):</span>
                                                  <span className="text-gray-700 ml-1 font-mono">{evidenceObj.uploadedBy}</span>
                                                </div>
                                              )}
                                              {evidenceObj.hash && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500 font-medium">Hash:</span>
                                                  <span className="text-gray-700 ml-1 font-mono text-xs truncate">{evidenceObj.hash}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-8 py-8 text-center">
                      <p className="text-sm text-gray-500">
                        No findings match your search criteria
                      </p>
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {filteredFindings.length > 0 && (
                  <div className="px-8 py-4 border-t border-gray-200 bg-gray-50">
                    <Suspense
                      fallback={
                        <div className="text-sm text-gray-500">Loading...</div>
                      }
                    >
                      <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        itemsPerPage={itemsPerPage}
                        totalItems={filteredFindings.length}
                        pageRange={pageRange}
                        canGoNext={canGoNext}
                        canGoPrevious={canGoPrevious}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        onNext={goToNextPage}
                        onPrevious={goToPreviousPage}
                      />
                    </Suspense>
                  </div>
                )}
              </div>

              {/* Evidence Modal */}
              {modalState.isOpen && (
                <>
                  {/* Modal Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={closeModal}
                  />

                  {/* Modal Dialog */}
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                    <div
                      className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                        <div className="flex-1 pr-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {modalState.filename}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {modalState.description}
                          </p>
                        </div>
                        <button
                          onClick={closeModal}
                          className="flex-shrink-0 inline-flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Close modal"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>

                      {/* Modal Content */}
                      <div className="flex-1 overflow-y-auto p-6">
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-700">
                            <strong>File:</strong> {modalState.filename}
                          </p>
                          <p className="text-sm text-gray-600 mt-2">
                            {modalState.fileSize || 'Unknown size'} • {modalState.uploadedAt || 'Unknown date'}
                          </p>
                          <p className="text-sm text-gray-700 mt-3 italic">
                            {modalState.description}
                          </p>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-300 min-h-[450px] flex items-center justify-center overflow-auto">
                          {modalState.contentUrl && (
                            <>
                              {modalState.filename?.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                  src={`${modalState.contentUrl}#toolbar=1&navpanes=0`}
                                  className="w-full h-[450px] rounded"
                                  title="PDF Preview"
                                  onError={() => {
                                    console.warn('[Evidence Modal] PDF preview failed to load');
                                  }}
                                />
                              ) : (
                                <>
                                  {['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(
                                    modalState.filename?.split('.').pop()?.toLowerCase() || '',
                                  ) ? (
                                    <div className="flex items-center justify-center p-4 max-w-full">
                                      <img
                                        src={modalState.contentUrl}
                                        alt={modalState.filename}
                                        className="max-h-[450px] max-w-full object-contain rounded"
                                        onError={() => {
                                          console.warn('[Evidence Modal] Image preview failed to load');
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="text-center p-8">
                                      <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                      <p className="text-gray-600 font-medium mb-2">
                                        {modalState.filename?.split('.').pop()?.toUpperCase() || 'FILE'}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        Preview not available for this file type
                                      </p>
                                      <p className="text-sm text-gray-400 mt-1">
                                        Use Download button to open the file
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          ) || (
                            <div className="text-center p-8">
                              <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600 font-medium mb-2">
                                {modalState.filename?.split('.').pop()?.toUpperCase() || 'FILE'}
                              </p>
                              <p className="text-sm text-gray-500">
                                Unable to load preview
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button
                          onClick={closeModal}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => {
                            console.log('[Evidence Modal] Download button clicked, evidenceId:', modalState.evidenceId);
                            handleDownloadEvidence(modalState.evidenceId || modalState.filename);
                            closeModal();
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg text-sm font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceFindingsReport;
