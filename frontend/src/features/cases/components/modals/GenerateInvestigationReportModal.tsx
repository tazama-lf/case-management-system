import React, { useState } from 'react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/solid';
import { useNotifications } from '@/shared/providers/NotificationProvider';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).vfs;

interface GenerateInvestigationReportModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseTitle?: string;
}

const GenerateInvestigationReportModal: React.FC<GenerateInvestigationReportModalProps> = ({
  open,
  onClose,
  caseId,
  caseTitle = 'Case CASE-2023-0045 - Fraud',
}) => {
  const { showSuccess, showError } = useNotifications();
  const [step, setStep] = useState<'initial' | 'generated'>('initial');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // State for editable report sections
  const [executiveSummary, setExecutiveSummary] = useState(
    "This report summarizes the investigation of Case CASE-2023-0045, a Fraud case with typology TYP-001 (Risk Score: 1450). The investigation was conducted by John Smith and submitted for approval on 2023-05-14 10:23 AM. After thorough analysis of the evidence and transaction patterns, the investigator has recommended the outcome: Confirmed Fraud."
  );
  const [keyFindings, setKeyFindings] = useState(
    "1. Transaction Analysis: Multiple suspicious transactions were identified showing patterns consistent with fraud activity.\n\n2. Customer Behavior: The customer's account activity deviated significantly from their established transaction profile.\n\n3. Evidence Review: Documentary evidence including transaction logs, account statements, and communication records support the investigator's conclusions.\n\n4. Risk Assessment: The case presents a high risk level based on the typology score of 1450 and the nature of the suspicious activity."
  );
  const [recommendations, setRecommendations] = useState(
    "Based on the investigation findings and evidence review:\n\n1. The recommended outcome of 'Confirmed Fraud' is supported by the evidence.\n2. Recommend escalation to compliance team for regulatory reporting.\n3. Suggest account monitoring and enhanced due diligence for related entities."
  );

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
    setStep('generated');
  };

  const generateReportContent = () => {
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return `
CASE INVESTIGATION REPORT
${caseTitle}
Generated: ${timestamp}

================================================================================

CASE INFORMATION
----------------
Case ID: CASE-2023-0045
Type: Fraud
Investigator: John Smith
Submitted: 2023-05-14 10:23 AM

================================================================================

EXECUTIVE SUMMARY
-----------------
${executiveSummary}

================================================================================

KEY FINDINGS
------------
${keyFindings}

================================================================================

EVIDENCE SUMMARY
----------------
• Transaction logs showing suspicious patterns (3 documents)
• Customer account statements for review period (2 documents)
• Communication records and correspondence (5 documents)
• Supporting documentation and reference materials (4 documents)

All evidence items are attached to this case and available for audit review.

================================================================================

RECOMMENDATIONS & CONCLUSIONS
------------------------------
${recommendations}

================================================================================

Report End
This report was generated electronically and contains sensitive information.
Handle according to data protection and confidentiality policies.
    `.trim();
  };

  const handleDownload = () => {
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const docDefinition: any = {
        pageSize: 'A4',
        pageOrientation: 'portrait',
        pageMargins: [40, 60, 40, 60],
        content: [
          {
            text: 'CASE INVESTIGATION REPORT',
            style: 'header',
            margin: [0, 0, 0, 10],
          },
          {
            text: caseTitle,
            style: 'subheader',
            margin: [0, 0, 0, 5],
          },
          {
            text: `Generated: ${timestamp}`,
            style: 'timestamp',
            margin: [0, 0, 0, 20],
          },
          {
            canvas: [
              { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#3b82f6' }
            ],
            margin: [0, 0, 0, 20],
          },

          // Case Information Section
          {
            text: 'CASE INFORMATION',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            columns: [
              {
                width: '50%',
                stack: [
                  { text: [{ text: 'Case ID: ', bold: true }, 'CASE-2023-0045'], margin: [0, 0, 0, 5] },
                  { text: [{ text: 'Type: ', bold: true }, 'Fraud'], margin: [0, 0, 0, 5] },
                ]
              },
              {
                width: '50%',
                stack: [
                  { text: [{ text: 'Investigator: ', bold: true }, 'John Smith'], margin: [0, 0, 0, 5] },
                  { text: [{ text: 'Submitted: ', bold: true }, '2023-05-14 10:23 AM'], margin: [0, 0, 0, 5] },
                ]
              }
            ],
            margin: [0, 0, 0, 20],
          },

          // Executive Summary Section
          {
            text: 'EXECUTIVE SUMMARY',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            text: executiveSummary,
            style: 'body',
            margin: [0, 0, 0, 20],
          },

          // Key Findings Section
          {
            text: 'KEY FINDINGS',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            text: keyFindings,
            style: 'body',
            margin: [0, 0, 0, 20],
          },

          // Evidence Summary Section
          {
            text: 'EVIDENCE SUMMARY',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            ul: [
              'Transaction logs showing suspicious patterns (3 documents)',
              'Customer account statements for review period (2 documents)',
              'Communication records and correspondence (5 documents)',
              'Supporting documentation and reference materials (4 documents)',
            ],
            style: 'body',
            margin: [0, 0, 0, 5],
          },
          {
            text: 'All evidence items are attached to this case and available for audit review.',
            style: 'italic',
            margin: [0, 10, 0, 20],
          },

          // Recommendations Section
          {
            text: 'RECOMMENDATIONS & CONCLUSIONS',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            text: recommendations,
            style: 'body',
            margin: [0, 0, 0, 30],
          },

          // Footer
          {
            canvas: [
              { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#d1d5db' }
            ],
            margin: [0, 0, 0, 10],
          },
          {
            text: 'Report End',
            style: 'footer',
            margin: [0, 0, 0, 5],
          },
          {
            text: 'This report was generated electronically and contains sensitive information. Handle according to data protection and confidentiality policies.',
            style: 'disclaimer',
          },
        ],
        styles: {
          header: {
            fontSize: 20,
            bold: true,
            alignment: 'center',
            color: '#1f2937',
          },
          subheader: {
            fontSize: 14,
            bold: true,
            alignment: 'center',
            color: '#3b82f6',
          },
          timestamp: {
            fontSize: 10,
            alignment: 'center',
            color: '#6b7280',
            italics: true,
          },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            color: '#1f2937',
            decoration: 'underline',
            decorationColor: '#3b82f6',
          },
          body: {
            fontSize: 10,
            color: '#374151',
            lineHeight: 1.5,
          },
          italic: {
            fontSize: 9,
            color: '#6b7280',
            italics: true,
          },
          footer: {
            fontSize: 10,
            bold: true,
            alignment: 'center',
            color: '#1f2937',
          },
          disclaimer: {
            fontSize: 8,
            alignment: 'center',
            color: '#6b7280',
            italics: true,
          },
        },
        defaultStyle: {
          fontSize: 10,
          color: '#374151',
        },
      };

      const pdfDoc = (pdfMake as any).createPdf(docDefinition);
      pdfDoc.download(`Investigation_Report_${caseId}_${new Date().toISOString().split('T')[0]}.pdf`);

      // Show success notification
      showSuccess('Report downloaded successfully!');
    } catch (error) {
      console.error('Failed to download report:', error);
      showError('Failed to download report. Please try again.');
    }
  };

  const handlePrint = () => {
    const reportContent = generateReportContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Investigation Report - ${caseId}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                padding: 40px;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
              }
              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
              }
              @media print {
                body {
                  padding: 20px;
                }
              }
            </style>
          </head>
          <body>
            <pre>${reportContent}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);

    // Create the report data
    const reportData = {
      case_id: caseId,
      executive_summary: executiveSummary,
      key_findings: keyFindings,
      recommendations: recommendations,
      generated_at: new Date().toISOString(),
      finalized: true
    };

    try {
      // Save report to backend (implement your actual API call here)
      console.log('Finalizing report:', reportData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Show success notification
      showSuccess('Report has been finalized and saved successfully!');

      // Close modal after a short delay to allow user to see the success message
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to finalize report:', error);
      showError('Failed to finalize report. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleClose = () => {
    setStep('initial');
    setIsGenerating(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Generate Case Investigation Report
              </h3>
              <p className="text-sm text-gray-500">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto flex-1">
          {step === 'initial' && (
            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
                <DocumentTextIcon className="h-10 w-10 text-blue-600" />
              </div>

              {/* Title */}
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                Ready to Generate Report
              </h4>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-8 max-w-md">
                This will consolidate all investigation findings, evidence, and conclusions
                into a comprehensive report for your review and approval.
              </p>

              {/* Report Contents */}
              <div className="w-full max-w-md bg-gray-50 rounded-lg p-6 mb-8">
                <h5 className="text-sm font-semibold text-gray-700 mb-4 text-left">
                  Report will include:
                </h5>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <DocumentIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Executive Summary: </span>
                      <span className="text-sm text-gray-600">
                        Overview of the case, investigation scope, and key outcomes
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Key Findings: </span>
                      <span className="text-sm text-gray-600">
                        Detailed analysis of suspicious activities and patterns identified
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <DocumentIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Evidence Summary: </span>
                      <span className="text-sm text-gray-600">
                        Documentation and evidence collected during investigation
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Recommendations: </span>
                      <span className="text-sm text-gray-600">
                        Investigator's conclusions and recommended actions
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Generating Report...
                  </>
                ) : (
                  <>
                    <DocumentTextIcon className="h-5 w-5" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'generated' && (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-sm font-semibold text-blue-900 mb-1">
                      Report Generated Successfully
                    </h5>
                    <p className="text-sm text-blue-700">
                      Review the report content below. You can edit any section before finalizing and approving.
                    </p>
                  </div>
                </div>
              </div>

              {/* Case Metadata */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <DocumentIcon className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-700">Case ID:</span>
                    <span className="text-gray-900">CASE-2023-0045</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-700">Type:</span>
                    <span className="text-gray-900">Fraud</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Investigator:</span>
                    <span className="text-gray-900">John Smith</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Submitted:</span>
                    <span className="text-gray-900">2023-05-14 10:23 AM</span>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Executive Summary</h5>
                <textarea
                  value={executiveSummary}
                  onChange={(e) => setExecutiveSummary(e.target.value)}
                  className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Key Findings */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Key Findings</h5>
                <textarea
                  value={keyFindings}
                  onChange={(e) => setKeyFindings(e.target.value)}
                  className="w-full h-32 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Evidence Summary */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Evidence Summary</h5>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Transaction logs showing suspicious patterns (3 documents)</li>
                    <li>• Customer account statements for review period (2 documents)</li>
                    <li>• Communication records and correspondence (5 documents)</li>
                    <li>• Supporting documentation and reference materials (4 documents)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3 italic">
                    All evidence items are attached to this case and available for audit review.
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Recommendations & Conclusions</h5>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>

          {step === 'generated' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Report
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
              >
                {isFinalizing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Finalize & Approve Report
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateInvestigationReportModal;
