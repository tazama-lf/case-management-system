import React from 'react';
import {
  ChevronDownIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import type { FindingDetail } from '../types/reports.types';

interface FindingsDetailsTableProps {
  data: FindingDetail[];
  isLoading?: boolean;
  className?: string;
}

interface ModalState {
  isOpen: boolean;
  filename: string;
  description: string;
}

const FindingsDetailsTable: React.FC<FindingsDetailsTableProps> = ({
  data,
  isLoading = false,
  className = '',
}) => {
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(
    new Set(),
  );
  const [modalState, setModalState] = React.useState<ModalState>({
    isOpen: false,
    filename: '',
    description: '',
  });

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleViewEvidence = (filename: string, description: string) => {
    setModalState({ isOpen: true, filename, description });
  };

  const handleDownloadEvidence = (filename: string) => {
    try {
      const mockFileContent = `Evidence Document: ${filename}\n\nThis is a mock download of the evidence file.\n\nIn production, this would download the actual file from your document storage system.`;
      const blob = new Blob([mockFileContent], {
        type: 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download document. Please try again.');
    }
  };

  const closeModal = () => {
    setModalState({ isOpen: false, filename: '', description: '' });
  };

  const getStatusColor = (conclusion: string) => {
    switch (conclusion) {
      case 'Confirmed':
        return 'bg-green-50 text-green-700 ring-green-600/20';
      case 'Refuted':
        return 'bg-red-50 text-red-700 ring-red-600/20';
      case 'Inconclusive':
        return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-600/20';
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Case ID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Finding
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Conclusion
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Evidence
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
              >
                Date
              </th>
              <th
                scope="col"
                className="relative px-6 py-3 text-left text-xs font-semibold text-gray-700"
              >
                <span className="sr-only">Expand</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.length > 0 ? (
              data.map((finding, index) => (
                <React.Fragment key={index}>
                  <tr
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => {
                      toggleExpanded(index);
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {finding.caseId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <p className="truncate">{finding.finding}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(finding.conclusion)}`}
                      >
                        {finding.conclusion}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        {finding.evidenceCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(finding.dateIdentified).toLocaleDateString(
                        'en-GB',
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <ChevronDownIcon
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          expandedRows.has(index) ? 'rotate-180' : ''
                        }`}
                      />
                    </td>
                  </tr>
                  {expandedRows.has(index) && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">
                              Supporting Evidence
                            </h4>
                            <div className="space-y-2">
                              {finding.supportingEvidence.map(
                                (evidence, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-white rounded px-3 py-2 border border-gray-200 hover:border-gray-300 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                      <span className="truncate">
                                        {evidence}
                                      </span>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewEvidence(
                                            evidence,
                                            'Transaction logs showing duplicate payments',
                                          );
                                        }}
                                        className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="View evidence"
                                      >
                                        <EyeIcon className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadEvidence(evidence);
                                        }}
                                        className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                        title="Download evidence"
                                      >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">
                              Full Finding Description
                            </h4>
                            <p className="text-sm text-gray-700 bg-white rounded px-3 py-2 border border-gray-200">
                              {finding.finding}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No findings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
              onClick={(e) => {
                e.stopPropagation();
              }}
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
                    2.40 KB • Jan 15, 2024, 09:30 AM
                  </p>
                  <p className="text-sm text-gray-700 mt-3 italic">
                    {modalState.description}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-300 p-8 min-h-[350px] flex items-center justify-center">
                  <div className="text-center">
                    <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-2">
                      Document Preview
                    </p>
                    <p className="text-sm text-gray-500">
                      This is a mock preview of the evidence document.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      In production, this would display the actual document
                      content.
                    </p>
                  </div>
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
                    handleDownloadEvidence(modalState.filename);
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
  );
};

export default FindingsDetailsTable;
