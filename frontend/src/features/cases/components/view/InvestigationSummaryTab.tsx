import React, { useState, useEffect } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from '../casesTable.utils';
import { caseService } from '../../services/caseService';
import type { Case } from '@/features/alerts/types/triage.types';
import GenerateInvestigationReportModal from '../modals/GenerateInvestigationReportModal';

interface InvestigationSummaryTabProps {
  caseId: string;
  row?: CaseRow;
}

interface EvidenceItem {
  type: string;
  count: number;
  description: string;
}

const InvestigationSummaryTab: React.FC<InvestigationSummaryTabProps> = ({ caseId, row }) => {
  const [caseDetails, setCaseDetails] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    const fetchCaseDetails = async () => {
      try {
        setLoading(true);
        const details = await caseService.getCaseDetails(caseId);
        setCaseDetails(details);
      } catch (error) {
        console.error('Failed to fetch case details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseDetails();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Mock evidence data - replace with actual data from your API
  const evidenceSummary: EvidenceItem[] = [
    {
      type: 'Transaction logs showing suspicious patterns',
      count: 3,
      description: 'documents'
    },
    {
      type: 'Customer account statements for review period',
      count: 2,
      description: 'documents'
    },
    {
      type: 'Communication records and correspondence',
      count: 5,
      description: 'documents'
    },
    {
      type: 'Supporting documentation and reference materials',
      count: 4,
      description: 'documents'
    }
  ];

  const getOutcomeLabel = (status: string): string => {
    if (status?.includes('CONFIRMED')) return 'Confirmed Fraud';
    if (status?.includes('REFUTED')) return 'Refuted';
    if (status?.includes('INCONCLUSIVE')) return 'Inconclusive';
    return 'Under Investigation';
  };

  const getOutcomeColor = (status: string): string => {
    if (status?.includes('CONFIRMED')) return 'text-red-700 bg-red-50';
    if (status?.includes('REFUTED')) return 'text-green-700 bg-green-50';
    if (status?.includes('INCONCLUSIVE')) return 'text-yellow-700 bg-yellow-50';
    return 'text-blue-700 bg-blue-50';
  };

  return (
    <>
      <div className="space-y-6">
        {/* Generate Report Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all"
          >
            <DocumentTextIcon className="h-5 w-5" />
            Generate Report
          </button>
        </div>

        {/* Recommended Outcome Section */}
        <div className="rounded-lg border border-gray-200 bg-blue-50 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Recommended Outcome
          </h3>
          <div className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${getOutcomeColor(caseDetails?.status || '')}`}>
            {getOutcomeLabel(caseDetails?.status || '')}
          </div>
        </div>

      {/* Investigation Notes Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Investigation Notes
        </h3>
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            The investigation revealed multiple suspicious transactions that align with the triggered typologies.
            Detailed analysis of transaction patterns, customer behavior, and supporting evidence has been completed.
          </p>
          <p>
            All evidence has been collected and documented according to standard procedures. The findings support
            the recommended outcome based on the risk assessment and regulatory requirements.
          </p>
        </div>
      </div>

      {/* Evidence Summary Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Evidence Summary
        </h3>
        <div className="space-y-3">
          {evidenceSummary.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <DocumentTextIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-sm text-gray-900">{item.type}</span>
                <span className="text-sm text-gray-500 ml-1">
                  ({item.count} {item.description})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

        {/* Case Metadata */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Case ID:</span>
              <span className="ml-2 text-gray-900">{caseDetails?.case_id || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Priority:</span>
              <span className="ml-2 text-gray-900">{caseDetails?.priority || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Case Type:</span>
              <span className="ml-2 text-gray-900">{caseDetails?.case_type || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-900">
                {caseDetails?.created_at ? new Date(caseDetails.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Report Modal */}
      <GenerateInvestigationReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        caseId={caseId}
        caseTitle={`Case ${caseDetails?.case_id || caseId} - ${caseDetails?.case_type || 'Investigation'}`}
      />
    </>
  );
};

export default InvestigationSummaryTab;
