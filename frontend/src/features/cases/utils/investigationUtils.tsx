import type { Evidence } from '../types/evidence.types';
import type { Case } from '@/features/alerts/types/triage.types';
import type { TaskComment } from '../services/commentService';
import { evidenceService } from '../services/evidenceService';
import { caseService } from '../services/caseService';
import { commentService } from '../services/commentService';
import { taskService } from '../services/taskService';
import { formatDate } from '@/shared/utils/dateUtils';

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
  supervisorComments: TaskComment[];
  investigatorName: string;
  investigationTask: any;
  investigationNotes: string;
  submittedDate: string;
}> => {
  let caseDetails: Case | null = null;
  let supervisorComments: TaskComment[] = [];
  const investigatorName = 'N/A';
  let submittedDate = 'N/A';
  let investigationTask: any = null;
  let investigationNotes = '';

  try {
    caseDetails = await caseService.getCaseDetails(caseId);
    const tasks = await taskService.getTasksByCaseId(caseId);
    investigationTask = tasks.find((t) => t.task_id === currentTaskId);

    if (investigationTask) {
      if (investigationTask.updated_at) {
        submittedDate = investigationTask.updated_at
          ? formatDate(investigationTask.updated_at)
          : 'N/A';
      }

      if (investigationTask.investigationNotes) {
        investigationNotes = investigationTask.investigationNotes;
      }
    }

    const approvalTask = tasks.find((t) =>
      t.name?.toLowerCase().includes('approve'),
    );
    if (approvalTask) {
      supervisorComments =
        (await commentService.getCommentsByTask(approvalTask.task_id)) || [];
    }
  } catch (error) {
    console.error('Error fetching case and evidence:', error);
  }

  return {
    caseDetails,
    supervisorComments,
    investigatorName,
    investigationTask,
    investigationNotes,
    submittedDate,
  };
};
