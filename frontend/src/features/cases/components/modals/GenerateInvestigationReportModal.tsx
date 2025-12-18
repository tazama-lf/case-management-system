import React, { useState, useEffect } from 'react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentIcon
} from '@heroicons/react/24/solid';
import { useNotifications } from '@/shared/providers/NotificationProvider';
import userService from '../../services/userService';
import { taskService } from '../../services/taskService';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

const getUserInfo = () => {
  try {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return {
        userId: userData.userId || '',
        tenantId: userData.tenantId || '',
      };
    }
  } catch { }
  return { userId: '', tenantId: '' };
};

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
  } catch { }
  return 'CMS_SUPERVISOR';
};

(pdfMake as any).vfs = (pdfFonts as any).vfs;

interface GenerateInvestigationReportModalProps {
  open: boolean;
  onClose: () => void;
  caseId: number;
  caseTitle?: string;
  taskId?: number;
  caseData?: {
    case_id?: number;
    case_type?: string;
    status?: string;
    priority?: string;
    created_at?: string;
  };
  caseComments?: Array<{
    note?: string;
    user_id?: string;
    created_at?: string;
  }>;
  supervisorComments?: Array<{
    note?: string;
    user_id?: string;
    created_at?: string;
  }>;
  evidenceCount?: {
    [key: string]: number;
  };
  investigationNotes?: string;
}

const GenerateInvestigationReportModal: React.FC<GenerateInvestigationReportModalProps> = ({
  open,
  onClose,
  caseId,
  caseTitle = 'Case CASE-2023-0045 - Fraud',
  taskId,
  caseData,
  caseComments,
  supervisorComments,
  evidenceCount = {},
  investigationNotes,
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

  useEffect(() => {
    if (open && caseComments?.[0]?.user_id) {
      userService.getUserDetailsById(caseComments[0].user_id).then((userDetails) => {
        if (userDetails) {
          setInvestigatorName(userService.formatUserName(userDetails));
        }
      }).catch(() => { });
    }
  }, [open, caseComments]);

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

  const buildExecutiveSummary = () => {
    const investigatorComment = caseComments?.[0]?.note || '';
    const createdDate = caseData?.created_at ? new Date(caseData.created_at).toLocaleDateString() : 'N/A';
    const investigatorId = caseComments?.[0]?.user_id || 'Investigator';
    const caseType = caseData?.case_type || 'Investigation';
    const outcome = caseData?.status || 'Under Review';

    return `This report summarizes the investigation of Case ${caseData?.case_id || caseId}, a ${caseType} case. The investigation was conducted and submitted on ${createdDate}. After thorough analysis of the evidence and findings, the investigator has recommended the outcome: ${outcome}.`;
  };

  const buildEvidenceSummary = () => {
    if (!evidenceCount || Object.keys(evidenceCount).length === 0) {
      return 'No evidence items available for this case.';
    }

    const items = Object.entries(evidenceCount).map(([type, count]) =>
      `• ${type} (${count} ${count === 1 ? 'document' : 'documents'})`
    );
    return items.join('\n') + '\n\nAll evidence items are attached to this case and available for audit review.';
  };

  const [executiveSummary, setExecutiveSummary] = useState(buildExecutiveSummary());
  const [keyFindings, setKeyFindings] = useState(
    caseComments?.[0]?.note || "1. Investigation findings pending.\n\n2. Additional details to be added."
  );
  const [recommendations, setRecommendations] = useState(
    "Based on the investigation findings and evidence review:\n\n1. Review investigator's recommended outcome.\n2. Verify all evidence is properly documented.\n3. Follow organizational protocols for case closure."
  );
  const [supervisorFeedback, setSupervisorFeedback] = useState(
    supervisorComments?.[0]?.note || ""
  );
  const [evidenceSummary, setEvidenceSummary] = useState(buildEvidenceSummary());
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [reportOutcome, setReportOutcome] = useState<'Confirmed Fraud' | 'Refuted Fraud' | 'Under Monitoring'>('Confirmed Fraud');
  const [monitoringDuration, setMonitoringDuration] = useState<30 | 60 | 90 | 180>(30);
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [userRole] = useState<string>(getUserRole());

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const { userId, tenantId } = getUserInfo();
      const role = getUserRole();

      const payload = {
        caseId,
        investigatorInputs: keyFindings,
        supervisorRemarks: supervisorFeedback,
        userId,
        tenantId,
        role,
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/reports/fraud/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const report = await response.json();
      setCurrentReportId(report.reportId);
      showSuccess('Report generated successfully!');
      setStep('generated');
    } catch {
      showError('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
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

      const submittedDate = caseComments?.[0]?.created_at
        ? new Date(caseComments[0].created_at).toLocaleString()
        : 'N/A';

      const evidenceList = Object.entries(evidenceCount || {}).length > 0
        ? Object.entries(evidenceCount).map(([type, count]) =>
          `${type} (${count} ${count === 1 ? 'document' : 'documents'})`
        )
        : ['No evidence items available for this case.'];

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
          {
            text: executiveSummary,
            style: 'body',
            margin: [0, 0, 0, 20],
          },

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

          ...(supervisorFeedback ? [
            {
              text: 'SUPERVISOR FEEDBACK',
              style: 'sectionHeader',
              margin: [0, 0, 0, 10],
            },
            {
              text: supervisorFeedback,
              style: 'body',
              margin: [0, 0, 0, 20],
            },
          ] : []),

          {
            text: 'EVIDENCE SUMMARY',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            ul: evidenceList,
            style: 'body',
            margin: [0, 0, 0, 5],
          },
          {
            text: 'All evidence items are attached to this case and available for audit review.',
            style: 'italic',
            margin: [0, 10, 0, 20],
          },

          {
            text: 'FINAL OUTCOME DECISION',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            text: reportOutcome,
            style: 'outcomeDecision',
            margin: [0, 0, 0, 20],
          },

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

      const pdfDoc = (pdfMake as any).createPdf(docDefinition);
      pdfDoc.download(`Investigation_Report_${caseId}_${new Date().toISOString().split('T')[0]}.pdf`);

      showSuccess('Report downloaded successfully!');
    } catch {
      showError('Failed to download report. Please try again.');
    }
  };

  const handlePrint = () => {
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const submittedDate = caseComments?.[0]?.created_at
        ? new Date(caseComments[0].created_at).toLocaleString()
        : 'N/A';

      const evidenceList2 = Object.entries(evidenceCount || {}).length > 0
        ? Object.entries(evidenceCount).map(([type, count]) =>
          `${type} (${count} ${count === 1 ? 'document' : 'documents'})`
        )
        : ['No evidence items available for this case.'];

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
          {
            text: executiveSummary,
            style: 'body',
            margin: [0, 0, 0, 20],
          },

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

          ...(supervisorFeedback ? [
            {
              text: 'SUPERVISOR FEEDBACK',
              style: 'sectionHeader',
              margin: [0, 0, 0, 10],
            },
            {
              text: supervisorFeedback,
              style: 'body',
              margin: [0, 0, 0, 20],
            },
          ] : []),

          {
            text: 'EVIDENCE SUMMARY',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            ul: evidenceList2,
            style: 'body',
            margin: [0, 0, 0, 5],
          },
          {
            text: 'All evidence items are attached to this case and available for audit review.',
            style: 'italic',
            margin: [0, 10, 0, 20],
          },

          {
            text: 'FINAL OUTCOME DECISION',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10],
          },
          {
            text: reportOutcome,
            style: 'outcomeDecision',
            margin: [0, 0, 0, 20],
          },

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

      const pdfDoc = (pdfMake as any).createPdf(docDefinition);
      pdfDoc.print();
    } catch {
      showError('Failed to print report. Please try again.');
    }
  };

  const handleApproveClick = () => {
    setShowApprovalConfirm(true);
  };

  const handleFinalize = async () => {
    setShowApprovalConfirm(false);
    setIsFinalizing(true);

    try {
      if (currentReportId) {
        const updatePayload = {
          keyFindings,
          recommendations,
          supervisorRemarks: supervisorFeedback,
          decisions: reportOutcome,
        };

        const updateResponse = await fetch(`${API_BASE_URL}/api/v1/reports/fraud/edit/${currentReportId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          },
          body: JSON.stringify(updatePayload),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(`Failed to update report: ${updateResponse.status} ${updateResponse.statusText} ${JSON.stringify(errorData)}`);
        }
      }

      const { userId: supervisorUserId } = getUserInfo();
      const supervisorName = investigatorName || 'Supervisor';

      const approvePayload = {
        reportId: currentReportId || `${caseId}-v1`,
        outcome: reportOutcome,
        supervisor: supervisorName,
        supervisorUserId,
        ...(reportOutcome === 'Under Monitoring' && { monitoringDuration }),
      };

      const approveResponse = await fetch(`${API_BASE_URL}/api/v1/reports/fraud/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
        body: JSON.stringify(approvePayload),
      });

      if (!approveResponse.ok) {
        const errorData = await approveResponse.json().catch(() => ({}));
        throw new Error(`Failed to approve report: ${approveResponse.status} ${approveResponse.statusText} ${JSON.stringify(errorData)}`);
      }

      if (taskId && investigationNotes) {
        try {
          await taskService.updateTaskForSupervisor(taskId, {
            investigationNotes: investigationNotes,
          });
        } catch {
        }
      }

      const outcomeKey = `fraud-report-outcome-${caseId}`;
      localStorage.setItem(outcomeKey, JSON.stringify({
        outcome: reportOutcome,
        approvedAt: new Date().toISOString(),
        reportId: currentReportId || `${caseId}-v1`,
      }));

      setIsApproved(true);
      showSuccess('Report has been finalized and approved successfully!');
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
                disabled={isGenerating || (userRole === 'CMS_SUPERVISOR' && (!tasksCompleted || checkingTasks))}
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
                      {caseComments?.[0]?.created_at
                        ? new Date(caseComments[0].created_at).toLocaleString()
                        : 'N/A'}
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
                <textarea
                  value={keyFindings}
                  onChange={(e) => {
                    setKeyFindings(e.target.value);
                    setIsApproved(false);
                  }}
                  disabled={userRole !== 'CMS_SUPERVISOR'}
                  className="w-full h-32 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Supervisor Feedback - moved next to Key Findings */}
              {supervisorComments && supervisorComments.length > 0 && (
                <div className="space-y-3">
                  <h5 className="text-sm font-semibold text-gray-900">Supervisor Feedback</h5>
                  <textarea
                    value={supervisorFeedback}
                    onChange={(e) => {
                      setSupervisorFeedback(e.target.value);
                      setIsApproved(false);
                    }}
                    disabled={userRole !== 'CMS_SUPERVISOR'}
                    className="w-full h-24 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
              )}

              {/* Evidence Summary */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Evidence Summary</h5>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    {Object.entries(evidenceCount || {}).map(([type, count]) => (
                      <li key={type}>• {type} ({count} {count === 1 ? 'document' : 'documents'})</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-3 italic">
                    All evidence items are attached to this case and available for audit review.
                  </p>
                </div>
              </div>

              {/* Report Outcome - for approval */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Final Outcome Decision</h5>
                <select
                  value={reportOutcome}
                  onChange={(e) => {
                    setReportOutcome(e.target.value as 'Confirmed Fraud' | 'Refuted Fraud' | 'Under Monitoring');
                    setIsApproved(false);
                  }}
                  disabled={userRole !== 'CMS_SUPERVISOR'}
                  className="w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                >
                  <option value="Confirmed Fraud">Confirmed Fraud</option>
                  <option value="Refuted Fraud">Refuted Fraud</option>
                  <option value="Under Monitoring">Under Monitoring</option>
                </select>
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
                    onClick={handleDownload}
                    disabled={!isApproved}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${isApproved
                      ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                      }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Report
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={!isApproved}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${isApproved
                      ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                      }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </button>
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
                onClick={() => setShowApprovalConfirm(false)}
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
