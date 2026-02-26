import React, { useState, useEffect } from 'react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentIcon
} from '@heroicons/react/24/solid';
import { useNotifications } from '@/shared/providers/NotificationProvider';
import { taskService } from '../../services/taskService';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { marked } from 'marked';
import htmlToPdfmake from 'html-to-pdfmake';
import type { Evidence } from '../../types/evidence.types';
import { reportsService } from '../../../reports/services/reportsService';
import { evidenceService } from '../../services/evidenceService';
import type { TaskDTO } from '../../services/caseService';
import { loadEvidence, fetchCasesAndEvidence } from '../../utils/investigationUtils';
import type { TaskComment } from '../../services/commentService';
import { formatDate } from '@/shared/utils/dateUtils';

interface EvidenceCategory {
  type: string;
  count: number;
  description: string;
  evidence: Evidence[];
}
interface GenerateInvestigationReportModalProps {
  open: boolean;
  onClose: () => void;
  caseId: number;
  caseStatus?: string;
  caseTitle?: string;
  taskId?: number;
  caseData?: {
    case_id?: number;
    case_type?: string;
    status?: string;
    priority?: string;
    createdOn?: string;
  };
  tasks?: TaskDTO[];
  selectedOutcome?: string;
  selectedFinalNotes?: string;
  onApproved?: () => void;

}

marked.setOptions({
  breaks: true,
  gfm: true,
});

const convertMarkdownToPdfMake = (markdownText: string): any => {
  if (!markdownText) return '';

  try {
    const html = marked(markdownText) as string;

    const pdfContent = htmlToPdfmake(html, {
      defaultStyles: {
        b: { bold: true },
        strong: { bold: true },
        u: { decoration: 'underline' },
        s: { decoration: 'lineThrough' },
        em: { italics: true },
        i: { italics: true },
        h1: { fontSize: 16, bold: true, marginTop: 10, marginBottom: 5 },
        h2: { fontSize: 14, bold: true, marginTop: 8, marginBottom: 4 },
        h3: { fontSize: 12, bold: true, marginTop: 6, marginBottom: 3 },
        h4: { fontSize: 11, bold: true, marginTop: 5, marginBottom: 2 },
        h5: { fontSize: 10, bold: true, marginTop: 4, marginBottom: 2 },
        h6: { fontSize: 10, bold: true, marginTop: 3, marginBottom: 2 },
        a: { color: 'blue', decoration: 'underline' },
        strike: { decoration: 'lineThrough' },
        p: { margin: [0, 5, 0, 5] },
        ul: { margin: [0, 5, 0, 5] },
        ol: { margin: [0, 5, 0, 5] },
        li: { margin: [0, 2, 0, 2] },
      }
    });

    return pdfContent;
  } catch (error) {
    console.error('Error converting markdown to pdfMake:', error);
    return markdownText;
  }
};

interface EvidenceCategory {
  type: string;
  count: number;
  description: string;
  evidence: Evidence[];
}

export const FINAL_OUTCOMES = [
  {
    value: 'STATUS_83_CLOSED_INCONCLUSIVE',
    label: '83 - Closed Inconclusive',
  },
  {
    value: 'STATUS_81_CLOSED_REFUTED',
    label: '81 - Closed Refuted',
  },
  {
    value: 'STATUS_82_CLOSED_CONFIRMED',
    label: '82 - Closed Confirmed',
  },
] as const;

export type FinalOutcomeType = typeof FINAL_OUTCOMES[number]['value'];

const getUserRole = () => {
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        const claims = decoded.claims || [];
        if (claims.includes('CMS_SUPERVISOR')) return 'CMS_SUPERVISOR';
        if (claims.includes('CMS_INVESTIGATOR')) return 'CMS_INVESTIGATOR';
      }
    }
  } catch {
    // Ignore JWTdecoding errors
  }
  return 'CMS_SUPERVISOR';
};

(pdfMake as any).vfs = (pdfFonts as any).vfs;

const GenerateInvestigationReportModal: React.FC<GenerateInvestigationReportModalProps> = ({
  caseStatus,
  open,
  onClose,
  caseId,
  caseTitle = 'Case CASE-2023-0045 - Fraud',
  tasks,
  caseData,
  selectedOutcome,
  selectedFinalNotes,
  onApproved,
}) => {
  const { showSuccess, showError } = useNotifications();
  const [step, setStep] = useState<'initial' | 'generated'>('initial');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [investigatorName, setInvestigatorName] = useState<string>('N/A');
  const [isApproved, setIsApproved] = useState(false);
  const [tasksCompleted, setTasksCompleted] = useState(false);
  const [incompleteTasks, setIncompleteTasks] = useState<string[]>([]);
  const [checkingTasks, setCheckingTasks] = useState(false);
  const [evidenceCategories, setEvidenceCategories] = useState<EvidenceCategory[]>([]);
  const [supervisorComments, setSupervisorComments] = useState<TaskComment[]>([]);
  const [investigationNotes, setInvestigationNotes] = useState<string>('');
  const [finalOutcome, setFinalOutcome] = useState<FinalOutcomeType | ''>((selectedOutcome as FinalOutcomeType) || '');
  const hasFetchedRef = React.useRef(false);
  const [evidenceLoaded, setEvidenceLoaded] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [submittedDate, setSubmittedDate] = useState<string>('N/A');

  useEffect(() => {
    hasFetchedRef.current = false;
  }, [caseId]);

  const latestInvestigateTask = React.useMemo(() => {
    if (!tasks?.length) return null;

    return tasks
      .filter(task =>
        task.name?.toLowerCase().includes('investigate'),
      )
      .sort((a, b) => {
        const aTime = new Date(a.created_at ?? 0).getTime();
        const bTime = new Date(b.created_at ?? 0).getTime();
        return bTime - aTime;
      })[0] || null;
  }, [tasks]);

  const isReportReady =
    !!latestInvestigateTask?.task_id &&
    evidenceLoaded &&
    commentsLoaded &&
    notesLoaded;

  const fetchEvidence = React.useCallback(async () => {
    if (!latestInvestigateTask?.task_id) return;
    try {
      const categories = await loadEvidence(latestInvestigateTask?.task_id);
      setEvidenceCategories(categories);
    } finally {
      setEvidenceLoaded(true);
    }
  }, [latestInvestigateTask]);

  const fetchCaseData = React.useCallback(async () => {
    if (!latestInvestigateTask?.task_id) return;

    try {
      const {
        supervisorComments,
        investigatorName,
        investigationNotes,
        submittedDate,
      } = await fetchCasesAndEvidence(caseId, latestInvestigateTask.task_id);
      setSupervisorComments(supervisorComments);
      setInvestigatorName(investigatorName);
      setSubmittedDate(submittedDate);
      setInvestigationNotes(investigationNotes);
    } catch (err) {
      console.error('Failed to fetch case data:', err);
    } finally {
      setCommentsLoaded(true);
      setNotesLoaded(true);
    }
  }, [caseId, latestInvestigateTask]);

  useEffect(() => {
    if (!open) return;
    if (!latestInvestigateTask?.task_id) return;
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;

    fetchEvidence();
    fetchCaseData();
  }, [open, latestInvestigateTask?.task_id, fetchEvidence, fetchCaseData]);

  useEffect(() => {
    if (selectedOutcome) {
      setFinalOutcome(selectedOutcome as FinalOutcomeType);
    }
  }, [selectedOutcome]);

  useEffect(() => {
    const checkTaskCompletion = async () => {
      if (!open || !caseId) return;

      setCheckingTasks(true);
      try {
        const tasks = await taskService.getTasksByCaseId(caseId);
        const investigationTasks = tasks.filter(task =>
          task.name?.toLowerCase().includes('investigate')
        );

        const incomplete = investigationTasks.filter(
          task => task.status !== 'STATUS_30_COMPLETED'
        );

        setIncompleteTasks(incomplete.map(t => t.name || 'Unknown Task'));
        setTasksCompleted(incomplete.length === 0);
      } catch (error) {
        showError('Failed to check task status');
        setTasksCompleted(false);
      } finally {
        setCheckingTasks(false);
      }
    };

    checkTaskCompletion();
  }, [open, caseId, showError]);

  useEffect(() => {
    setExecutiveSummary(buildExecutiveSummary());
  }, [finalOutcome, caseData?.createdOn, caseData?.case_type]);

  const buildExecutiveSummary = () => {
    const createdDate = caseData?.createdOn ? formatDate(caseData.createdOn) : 'N/A';
    const caseType = caseData?.case_type || 'Investigation';
    const outcome = finalOutcome || 'Under Review';

    return `This report summarizes the investigation of Case ${caseData?.case_id || caseId}, a ${caseType} case. The investigation was conducted and submitted on ${createdDate}. After thorough analysis of the evidence and findings, the investigator has recommended the outcome: ${outcome}.`;
  };

  const [executiveSummary, setExecutiveSummary] = useState(buildExecutiveSummary());
  const [keyFindings] = useState(
    investigationNotes || ''
  );
  const [recommendations, setRecommendations] = useState(
    'Based on the investigation findings and evidence review:\n\n1. Review investigator\'s recommended outcome.\n2. Verify all evidence is properly documented.\n3. Follow organizational protocols for case closure.'
  );
  const [supervisorFeedback, setSupervisorFeedback] = useState(
    supervisorComments?.[0]?.note || ''
  );
  const [reportOutcome] = useState<string | undefined>('');
  const [monitoringDuration, setMonitoringDuration] = useState<30 | 60 | 90 | 180>(30);
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [userRole] = useState<string>(getUserRole());


  const evidenceList = (evidenceCategories ?? []).map((category) => ({
    stack: [
      {
        text: `${category.type} (${category.count} ${category.description})`,
        bold: true,
        margin: [0, 5, 0, 3],
      },
      {
        ul: category.evidence.map((doc) => ({
          text: [
            { text: doc.fileName || 'Untitled Document', bold: true },
            {
              text: ` (${evidenceService.formatFileSize(doc.fileSize || 0)}`,
            },
            doc.uploadedAt
              ? { text: ` • ${formatDate(doc.uploadedAt)})` }
              : { text: ')' },
            doc.description
              ? { text: `\n${doc.description}`, italics: true }
              : '',
          ],
          margin: [0, 0, 0, 3],
        })),
      },
    ],
  }));

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
        text: `Case ${caseData?.case_id || caseId} - ${caseData?.case_type || 'Investigation'}`,
        style: 'subheader',
        margin: [0, 0, 0, 5],
      },
      {
        text: `Generated: ${formatDate(new Date().toISOString())}`,
        style: 'timestamp',
        margin: [0, 0, 0, 20],
      },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#3b82f6' }
        ],
        margin: [0, 0, 0, 20],
      },

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
              { text: [{ text: 'Case ID: ', bold: true }, caseData?.case_id || caseId || 'N/A'], margin: [0, 0, 0, 5] },
              { text: [{ text: 'Type: ', bold: true }, caseData?.case_type || 'Investigation'], margin: [0, 0, 0, 5] },
            ]
          },
          {
            width: '50%',
            stack: [
              { text: [{ text: 'Investigator: ', bold: true }, investigatorName], margin: [0, 0, 0, 5] },
              { text: [{ text: 'Submitted: ', bold: true }, submittedDate], margin: [0, 0, 0, 5] },
            ]
          }
        ],
        margin: [0, 0, 0, 20],
      },

      {
        text: 'EXECUTIVE SUMMARY',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      ...(Array.isArray(convertMarkdownToPdfMake(executiveSummary))
        ? convertMarkdownToPdfMake(executiveSummary)
        : [convertMarkdownToPdfMake(executiveSummary)]
      ),
      { text: '', margin: [0, 0, 0, 12] },

      {
        text: 'KEY FINDINGS',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      ...(investigationNotes
        ? (Array.isArray(convertMarkdownToPdfMake(investigationNotes))
          ? convertMarkdownToPdfMake(investigationNotes)
          : [convertMarkdownToPdfMake(investigationNotes)])
        : [{
          text: 'No investigation notes added.',
          fontSize: 9,
          color: '#6b7280',
          italics: true,
          margin: [0, 0, 0, 0],
        }]
      ),
      { text: '', margin: [0, 0, 0, 12] },

      ...((supervisorFeedback || selectedFinalNotes) ? [
        {
          text: 'SUPERVISOR FEEDBACK',
          style: 'sectionHeader',
          margin: [0, 0, 0, 10],
        },
        ...(Array.isArray(convertMarkdownToPdfMake(selectedFinalNotes || supervisorFeedback || ''))
          ? convertMarkdownToPdfMake(selectedFinalNotes || supervisorFeedback || '')
          : [convertMarkdownToPdfMake(selectedFinalNotes || supervisorFeedback || '')]
        ),
        { text: '', margin: [0, 0, 0, 12] },
      ] : []),

      {
        text: 'EVIDENCE SUMMARY',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      ...(evidenceList && evidenceList.length > 0
        ? [{
          ul: evidenceList,
          style: 'body',
          margin: [0, 0, 0, 12],
        }]
        : [{
          text: 'No evidence summary attached.',
          fontSize: 9,
          color: '#6b7280',
          italics: true,
          margin: [0, 0, 0, 0],
        }]
      ),
      { text: '', margin: [0, 0, 0, 12] },

      {
        text: 'FINAL OUTCOME DECISION',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      {
        text: finalOutcome as FinalOutcomeType,
        style: 'outcomeDecision',
        margin: [0, 0, 0, 12],
      },

      {
        text: 'RECOMMENDATIONS & CONCLUSIONS',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      ...(Array.isArray(convertMarkdownToPdfMake(recommendations))
        ? convertMarkdownToPdfMake(recommendations)
        : [convertMarkdownToPdfMake(recommendations)]
      ),
      { text: '', margin: [0, 0, 0, 30] },

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
      outcomeDecision: {
        fontSize: 12,
        bold: true,
        color: '#059669',
        alignment: 'center',
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

  const handleApproveClick = () => {
    setShowApprovalConfirm(true);
  };

  const generatePdfFile = async (docDefinition: any): Promise<File> => await new Promise((resolve, reject) => {
      try {
        const pdfDoc = (pdfMake as any).createPdf(docDefinition);

        pdfDoc.getBlob((blob: Blob) => {
          const file = new File([blob], 'report.pdf', {
            type: 'application/pdf',
          });
          resolve(file);
        });
      } catch (err) {
        reject(err);
      }
    });

  const handleGenerateReport = () => {
    if (!isReportReady) return;

    setIsGenerating(true);
    setStep('generated');

    setTimeout(() => {
      setIsGenerating(false);
    }, 300);
  };


  const handleFinalize = async () => {
    setShowApprovalConfirm(false);
    setIsFinalizing(true);

    try {
      const pdfFile = await generatePdfFile(docDefinition);
      try {
        const generateFraudReport = await reportsService.generateFraudReport({
          file: pdfFile,
          caseId,
          investigatorInputs: keyFindings,
          supervisorRemarks: supervisorFeedback,
          outcome: finalOutcome,
          reportType: 'INVESTIGATION_REPORT',
          description: 'Investigation Report',
        });

        if (!generateFraudReport) {
          throw new Error('Failed to generate report');
        }
        setStep('generated');


        if (latestInvestigateTask && investigationNotes) {
          try {
            await taskService.updateTaskForSupervisor(latestInvestigateTask.task_id, {
              investigationNotes,
            });
          } catch {
            // Ignore task update errors
          }
        }

        const outcomeKey = `fraud-report-outcome-${caseId}`;
        localStorage.setItem(outcomeKey, JSON.stringify({
          outcome: reportOutcome,
          approvedAt: new Date().toISOString(),
          reportId: generateFraudReport.fileName || `${caseId}-v1`,
        }));

      } catch {
        showError('Failed to generate report. Please try again.');
      } finally {
        setIsFinalizing(false);
      }

      setIsApproved(true);
      showSuccess('Report has been finalized and approved successfully!');
      onApproved?.();

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch {
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
                      <span className="text-sm font-medium text-gray-900">Final Outcome Decision: </span>
                      <span className="text-sm text-gray-600">
                        Final determination on case status and disposition
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

              {userRole === 'CMS_SUPERVISOR' && !tasksCompleted && incompleteTasks.length > 0 && (
                <div className="w-full max-w-md rounded-md bg-yellow-50 border border-yellow-200 p-4 mb-6">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Complete Investigation Tasks First
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>The following tasks must be completed before generating a report:</p>
                        <ul className="list-disc list-inside mt-1">
                          {incompleteTasks.map((task, idx) => (
                            <li key={idx}>{task}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerateReport}
                disabled={!isReportReady || (userRole === 'CMS_SUPERVISOR' && (!tasksCompleted || checkingTasks))}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {checkingTasks && userRole === 'CMS_SUPERVISOR' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Checking tasks...
                  </>
                ) : isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Generating Report...
                  </>
                ) : userRole === 'CMS_SUPERVISOR' && !tasksCompleted ? (
                  <>
                    <DocumentTextIcon className="h-5 w-5" />
                    Complete Tasks to Generate
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
                      {userRole === 'CMS_SUPERVISOR'
                        ? 'Review the report content below. You can edit any section before finalizing and approving.'
                        : 'Review the report content below.'}
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
                    <span className="text-gray-900">{caseData?.case_id || caseId || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-700">Type:</span>
                    <span className="text-gray-900">{caseData?.case_type || 'Investigation'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Investigator:</span>
                    <span className="text-gray-900">{investigatorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Submitted:</span>
                    <span className="text-gray-900">
                      {submittedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Executive Summary</h5>
                <textarea
                  value={executiveSummary}
                  onChange={(e) => {
                    setExecutiveSummary(e.target.value);
                    setIsApproved(false);
                  }}
                  disabled={userRole !== 'CMS_SUPERVISOR'}
                  className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Key Findings */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Key Findings</h5>
                {investigationNotes ? (
                  <div
                    className="markdown-content text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border border-gray-200"
                    dangerouslySetInnerHTML={{
                      __html: marked(investigationNotes) as string
                    }}
                  />
                ) : (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded border border-gray-200">
                    <em>No investigation notes added.</em>
                  </div>
                )}
              </div>

              {/* Supervisor Feedback */}
              {(selectedFinalNotes || (supervisorComments && supervisorComments.length > 0)) && (
                <div className="space-y-3">
                  <h5 className="text-sm font-semibold text-gray-900">Supervisor Feedback</h5>
                  {selectedFinalNotes ? (
                    <>
                      <div className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md min-h-[6rem] whitespace-pre-wrap">
                        {selectedFinalNotes}
                      </div>
                      <p className="text-xs text-gray-500 italic">
                        Supervisor comments provided in the previous step
                      </p>
                    </>
                  ) : (
                    <textarea
                      value={supervisorFeedback}
                      onChange={(e) => {
                        setSupervisorFeedback(e.target.value);
                        setIsApproved(false);
                      }}
                      disabled={userRole !== 'CMS_SUPERVISOR'}
                      className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              )}

              {/* Evidence Summary */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Evidence Summary</h5>

                <div className="bg-gray-50 rounded-lg p-4">
                  {evidenceCategories && evidenceCategories.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {evidenceCategories.map((category) => (
                          <div
                            key={category.type}
                            className="border border-gray-200 rounded-lg bg-white p-4"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {category.type}
                                </h4>
                              </div>
                              <span className="text-xs text-gray-500">
                                {category.count} {category.description}
                              </span>
                            </div>

                            {/* Evidence list */}
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {category.evidence.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded p-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {doc.fileName || 'Untitled Document'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                                      <span>{evidenceService.formatFileSize(doc.fileSize || 0)}</span>
                                      <span>•</span>
                                      <span>{doc.evidenceType}</span>
                                      {doc.uploadedAt && (
                                        <>
                                          <span>•</span>
                                          <span>
                                            {formatDate(doc.uploadedAt)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {doc.description && (
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {doc.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      <em>No evidence summary attached.</em>
                    </p>
                  )}
                </div>
              </div>


              {/* Report Outcome - Read-only display */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">
                  Final Outcome Decision
                </h5>

                <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {finalOutcome
                    ? FINAL_OUTCOMES.find(o => o.value === finalOutcome)?.label || 'Not specified'
                    : 'Not specified'
                  }
                </div>
              </div>


              {/* Monitoring Duration - only shown when Under Monitoring is selected */}
              {reportOutcome === 'Under Monitoring' && (
                <div className="space-y-3">
                  <h5 className="text-sm font-semibold text-gray-900">Monitoring Duration</h5>
                  <select
                    value={monitoringDuration}
                    onChange={(e) => {
                      setMonitoringDuration(Number(e.target.value) as 30 | 60 | 90 | 180);
                      setIsApproved(false);
                    }}
                    disabled={userRole !== 'CMS_SUPERVISOR'}
                    className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={180}>180 Days</option>
                  </select>
                  <p className="text-xs text-gray-500">Select the duration for continued monitoring of this case.</p>
                </div>
              )}

              {/* Recommendations */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Recommendations & Conclusions</h5>
                <textarea
                  value={recommendations}
                  onChange={(e) => {
                    setRecommendations(e.target.value);
                    setIsApproved(false);
                  }}
                  disabled={userRole !== 'CMS_SUPERVISOR'}
                  className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
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
              {userRole === 'CMS_SUPERVISOR' && (
                <>
                  <button
                    onClick={handleApproveClick}
                    disabled={isFinalizing || isApproved}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${isApproved
                      ? 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                      : 'text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed'
                      }`}
                  >
                    {isFinalizing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Finalizing...
                      </>
                    ) : isApproved ? (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Approved
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Finalize & Approve Report
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Approval Confirmation Dialog */}
      {showApprovalConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Confirm Report Approval</h4>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-sm text-gray-600">
                You are about to finalize and approve this investigation report. This action will:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Lock the report for editing</li>
                <li>Set the case outcome to: <strong>{reportOutcome}</strong></li>
                {reportOutcome === 'Under Monitoring' && (
                  <li>Set monitoring duration to: <strong>{monitoringDuration} days</strong></li>
                )}
                <li>Archive the report for compliance</li>
                <li>Notify relevant stakeholders</li>
              </ul>
              <p className="text-sm text-gray-600 font-medium">
                Are you sure you want to proceed?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowApprovalConfirm(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400"
              >
                {isFinalizing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Confirm Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateInvestigationReportModal;
