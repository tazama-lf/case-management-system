import type { Evidence } from '../types/evidence.types';
import type { Case } from '@/features/alerts/types/triage.types';
import type { TaskComment } from '../services/commentService';
import { evidenceService } from '../services/evidenceService';
import { caseService } from '../services/caseService';
import { commentService } from '../services/commentService';
import { taskService } from '../services/taskService';
import userService from '../services/userService';

export interface EvidenceCategory {
  type: string;
  count: number;
  description: string;
  evidence: Evidence[];
}

export const loadEvidence = async (
  taskId: number,
): Promise<EvidenceCategory[]> => {
  const evidenceResponse = await evidenceService.getTaskEvidence(taskId);

  const groupedByType = new Map<string, Evidence[]>();

  if (evidenceResponse.evidence && Array.isArray(evidenceResponse.evidence)) {
    evidenceResponse.evidence.forEach((evidence) => {
      const type = evidence.evidenceType || 'OTHER';
      if (!groupedByType.has(type)) groupedByType.set(type, []);
      groupedByType.get(type)!.push(evidence);
    });
  }

  const getDisplayLabel = (type: string): string => {
    switch (type) {
      case 'KYC':
        return 'KYC/EDD Report';
      case 'SANCTIONS':
        return 'Sanctions Screening';
      case 'ADVERSE_MEDIA':
        return 'Adverse Media Screening';
      case 'SAR_STR_FILING':
        return 'SAR/STR Filing Documentation';
      case 'OTHER':
        return 'Other supporting Documentation and Reference Materials';
      default:
        return type;
    }
  };

  const ORDERED_TYPES = [
    'KYC',
    'SANCTIONS',
    'ADVERSE_MEDIA',
    'SAR_STR_FILING',
    'OTHER',
  ];
  const categories: EvidenceCategory[] = [];

  ORDERED_TYPES.forEach((type) => {
    const items = groupedByType.get(type);
    if (!items) return;

    categories.push({
      type: getDisplayLabel(type),
      count: items.length,
      description: items.length === 1 ? 'document' : 'documents',
      evidence: items,
    });
  });

  // Add any remaining types not in ORDERED_TYPES
  groupedByType.forEach((items, type) => {
    if (ORDERED_TYPES.includes(type)) return;
    categories.push({
      type: getDisplayLabel(type),
      count: items.length,
      description: items.length === 1 ? 'document' : 'documents',
      evidence: items,
    });
  });

  return categories;
};

export const fetchCasesAndEvidence = async (
  caseId: number,
  currentTaskId: number,
): Promise<{
  caseDetails: Case | null;
  caseComments: TaskComment[];
  supervisorComments: TaskComment[];
  investigatorName: string;
  investigationTask: any;
  investigationNotes: string;
}> => {
  let caseDetails: Case | null = null;
  let caseComments: TaskComment[] = [];
  let supervisorComments: TaskComment[] = [];
  let investigatorName = 'N/A';
  let investigationTask: any = null;
  let investigationNotes = '';

  try {
    caseDetails = await caseService.getCaseDetails(caseId);
    caseComments = (await commentService.getCommentsByCase(caseId)) || [];

    if (caseComments.length > 0 && caseComments[0].user_id) {
      const userDetails = await userService.getUserDetailsById(
        caseComments[0].user_id,
      );
      if (userDetails) {
        investigatorName = userService.formatUserName(userDetails);
      }
    }

    const tasks = await taskService.getTasksByCaseId(caseId);

    const approvalTask = tasks.find((t) =>
      t.name?.toLowerCase().includes('approve'),
    );
    if (approvalTask) {
      supervisorComments =
        (await commentService.getCommentsByTask(approvalTask.task_id)) || [];
    }

    investigationTask = tasks.find((t) => t.task_id === currentTaskId);
    if (investigationTask?.investigationNotes) {
      investigationNotes = investigationTask.investigationNotes;
    }
  } catch (error) {
    console.error('Error fetching case and evidence:', error);
  }

  return {
    caseDetails,
    caseComments,
    supervisorComments,
    investigatorName,
    investigationTask,
    investigationNotes,
  };
};
