import type { TaskEvidence } from '../types/reports.types';

/**
 * Groups a case's evidence items by task id and normalises each item into
 * the SupportingEvidence shape the Evidence Findings report expects.
 * Extracted from reportsService.getEvidenceFindingsData purely to keep that
 * file under the max-lines lint budget.
 */
export default function mapEvidenceToTasks(
  caseEvidence: Array<Record<string, unknown>>,
): TaskEvidence[] {
  const evidenceByTask: Record<string, Array<Record<string, unknown>>> = {};

  caseEvidence.forEach((e) => {
    const rawTaskId = e.taskId ?? e.task_id;
    const taskId =
      typeof rawTaskId === 'string' || typeof rawTaskId === 'number'
        ? String(rawTaskId)
        : 'unknown_task';
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Dynamic key access may return undefined at runtime
    evidenceByTask[taskId] ||= [];
    evidenceByTask[taskId].push(e);
  });

  return Object.entries(evidenceByTask).map(([taskId, evidences]) => ({
    taskId: taskId === 'unknown_task' ? undefined : Number(taskId),
    supportingEvidence: evidences.map((e) => {
      const attachments = e.attachments as
        | Array<Record<string, unknown>>
        | undefined;
      const firstAttachment = attachments?.[0];

      return {
        id:
          ((e.id as string | undefined) ?? '') ||
          ((e.evidenceId as string | undefined) ?? '') ||
          ((e.evidence_id as string | undefined) ?? '') ||
          `unknown_${String(Date.now())}`,
        fileName: (e.fileName ??
          e.file_name ??
          firstAttachment?.fileName ??
          'Unknown Document') as string,
        fileSize: (e.fileSize ?? firstAttachment?.fileSize) as
          | number
          | undefined,
        mimeType: (e.mimeType ?? firstAttachment?.mimeType) as
          | string
          | undefined,
        evidenceType: e.evidenceType as string | undefined,
        uploadedBy: e.uploadedBy as string | undefined,
        uploadedByName: e.uploadedByName as string | undefined,
        uploadedAt: e.uploadedAt as string | undefined,
        description: e.description as string | undefined,
        hash: (e.hash ?? firstAttachment?.hash) as string | undefined,
      };
    }),
  }));
}
