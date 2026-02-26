import React, { useState, Suspense, useEffect } from 'react';
import {
  ExclamationCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import EvidenceFindingsStatsCards from '../components/EvidenceFindingsStatsCards';
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
import { evidenceService } from '../../cases/services/evidenceService';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';
import EvidenceCard from '@/features/reports/components/EvidenceCard';
import { formatDate } from '@/shared/utils/dateUtils';

const PaginationControls = React.lazy(
  async () => await import('../../../shared/PaginationControls'),
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const {
    investigators,
    supervisors,
    fetchInvestigatorsList,
    fetchSupervisorsList,
    complianceOfficers,
    fetchComplianceOfficersList,
  } = useInvestigatorSupervisorList();
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (investigators.length === 0) {
      fetchInvestigatorsList();
    }
    if (supervisors.length === 0) {
      fetchSupervisorsList();
    }
    if (complianceOfficers.length === 0) {
      fetchComplianceOfficersList();
    }
  }, []);

  const getAssigneeFullName = (assigneeName?: string, assignee?: string) => {
    const compliance = complianceOfficers.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (compliance) return `${compliance.firstName} ${compliance.lastName}`;

    const inv = investigators.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return '';
  };

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

  const handleViewEvidence = async (filename: string, evidenceId: string) => {
    const actualEvidenceId = evidenceId;
    setViewingId(actualEvidenceId);

    try {
      console.log('[Evidence View] Starting view for:', {
        actualEvidenceId,
        filename,
      });

      // Fetch the encrypted blob from CouchDB
      const blob = await evidenceService.viewEvidence(actualEvidenceId);

      console.log('[Evidence View] Blob received:', {
        size: blob.size,
        type: blob.type,
      });

      if (blob.size === 0) {
        throw new Error('Received empty file');
      }

      // Determine the best way to preview based on MIME type
      const mimeType = blob.type || 'application/octet-stream';
      const isPreviewable = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'text/plain',
        'text/html',
        'text/csv',
      ].some((type) => mimeType.includes(type));

      // Create blob URL
      const blobUrl = URL.createObjectURL(blob);

      if (isPreviewable) {
        // Open in new tab for previewable files
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        console.log('[Evidence View] Opened in new tab:', blobUrl);
      } else {
        // For non-previewable files, inform user and offer download
        const shouldDownload = confirm(
          `This file type (${mimeType}) cannot be previewed in the browser.\n\nWould you like to download it instead?`,
        );

        if (shouldDownload) {
          // Trigger download
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('[Evidence View] File downloaded:', filename);
        }

        // Clean up immediately if not downloading
        if (!shouldDownload) {
          URL.revokeObjectURL(blobUrl);
        }
      }

      // Clean up blob URL after a delay (for previewable files)
      if (isPreviewable) {
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          console.log('[Evidence View] Cleaned up blob URL');
        }, 30000); // 30 seconds should be enough for the browser to load it
      }
    } catch (err) {
      console.error('[Evidence View] Error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to view evidence: ${errorMessage}`);
    } finally {
      setViewingId(null);
    }
  };

  const handleDownloadEvidence = async (evidenceId: string) => {
    setDownloadingId(evidenceId);

    try {
      console.log('[Evidence Download] Starting download:', { evidenceId });

      // First get the evidence metadata to get the real filename
      const metadata = await evidenceService.getEvidenceById(evidenceId);
      const downloadFilename =
        metadata.fileName || metadata.attachments?.[0]?.fileName || 'evidence';

      console.log(
        '[Evidence Download] Fetching file blob for:',
        downloadFilename,
      );

      // Use evidenceService to download with proper auth handling
      const blob = await evidenceService.downloadEvidence(evidenceId);

      if (blob.size === 0) {
        throw new Error('Received empty file from server');
      }

      console.log(
        '[Evidence Download] Blob received, size:',
        blob.size,
        'bytes',
      );

      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Create and trigger download
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

      // Show success message briefly
      console.log('[Evidence Download] ✓ Download started successfully');
    } catch (err) {
      console.error('[Evidence Download] Download failed:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to download file: ${errorMessage}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const {
    stats = {
      totalFindings: 0,
      evidenceItems: 0,
      confirmedFindings: 0,
      refutedFindings: 0,
      inProgressFindings: 0,
      inconclusiveFindings: 0,
    },
    findings = [],
  } = displayData || {};

  // Filter findings based on search and status
  const filteredFindings = (findings || []).filter((finding: FindingDetail) => {
    const matchesSearch =
      finding.finding.toLowerCase().includes(searchTerm.toLowerCase()) ||
      finding.caseId
        .toString()
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
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
  const getUniqueFindingId = (caseId: number, finding: string) =>
    `${caseId}-${finding}`;

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
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(
                            e.target.value as
                              | 'All'
                              | 'Confirmed'
                              | 'Refuted'
                              | 'Inconclusive',
                          );
                        }}
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
                      const caseUniqueId = getUniqueFindingId(
                        finding.caseId,
                        finding.finding,
                      );
                      const isCaseExpanded = expandedCaseId === caseUniqueId;

                      return (
                        <div
                          key={caseUniqueId}
                          className="p-6 hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Case Header */}
                          <div
                            className="cursor-pointer flex justify-between items-start"
                            onClick={() => {
                              setExpandedCaseId(
                                isCaseExpanded ? null : caseUniqueId,
                              );
                            }}
                          >
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {finding.finding}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                Date: {formatDate(finding.dateIdentified)}
                              </p>
                            </div>

                            <div className="flex gap-4 items-center">
                              <span
                                className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(finding.conclusion)}`}
                              >
                                {finding.conclusion}
                              </span>
                              <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                                {finding.evidenceCount} evidence items
                              </span>
                            </div>
                          </div>

                          {/* Expanded Case → Tasks */}
                          {isCaseExpanded && (
                            <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                              {finding.tasks.map((task) => {
                                const taskUniqueId = `task-${finding.caseId}-${task.taskId}`;
                                const isTaskExpanded =
                                  expandedTaskId === taskUniqueId;

                                return (
                                  <div key={taskUniqueId} className="space-y-2">
                                    {/* Task Header */}
                                    <div
                                      className="cursor-pointer flex justify-between items-center bg-gray-100 p-2 rounded"
                                      onClick={() => {
                                        setExpandedTaskId(
                                          isTaskExpanded ? null : taskUniqueId,
                                        );
                                      }}
                                    >
                                      <span className="text-sm font-medium">
                                        Task ID: {task.taskId}
                                      </span>
                                      <span className="text-xs font-medium bg-gray-200 px-2 py-1 rounded">
                                        {task.supportingEvidence.length}{' '}
                                        evidence
                                      </span>
                                    </div>

                                    {/* Expanded Task → Supporting Evidence */}
                                    {isTaskExpanded && (
                                      <div className="mt-2 space-y-3">
                                        {task.supportingEvidence.map(
                                          (evidence, idx) => (
                                            <EvidenceCard
                                              key={idx}
                                              evidence={evidence}
                                              viewingId={viewingId}
                                              downloadingId={downloadingId}
                                              handleViewEvidence={
                                                handleViewEvidence
                                              }
                                              handleDownloadEvidence={
                                                handleDownloadEvidence
                                              }
                                              getAssigneeFullName={
                                                getAssigneeFullName
                                              }
                                              formatFileSize={
                                                evidenceService.formatFileSize
                                              }
                                            />
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceFindingsReport;
