import { TASK_NAMES } from '../../constants/case.constants';

/**
 * What a RESTRICTED viewer (an investigator who was revoked from a case) may not see. They keep the
 * case in their queue with its details and task log, but the investigation material is withheld:
 * the Investigate Case task's notes, and the alert's transaction / evaluation data that feeds the
 * Visualizations tab. Evidence and comments are refused outright by their own gates.
 */

const INVESTIGATE_TASK_NAMES: string[] = [
  TASK_NAMES.INVESTIGATE_CASE,
  TASK_NAMES.INVESTIGATE_CASE_LOWER,
  TASK_NAMES.INVESTIGATE_FRAUD,
  TASK_NAMES.INVESTIGATE_AML,
];

const VISUALIZATION_ALERT_FIELDS = ['transaction', 'alert_data', 'network_map'] as const;

export const isInvestigateTask = (name: string | null | undefined): boolean =>
  name !== null && name !== undefined && INVESTIGATE_TASK_NAMES.includes(name);

/** Blanks the investigation notes of Investigate tasks; every other task is returned untouched. */
export function redactTasksForRestrictedView<T extends { name?: string | null; investigationNotes?: string | null }>(tasks: T[]): T[] {
  return tasks.map((task) => (isInvestigateTask(task.name) ? { ...task, investigationNotes: null } : task));
}

/** Blanks the fields that feed the Visualizations tab, leaving id/message/type/confidence in place. Only touches fields that are present. */
export function redactAlertForRestrictedView<A>(alert: A): A {
  if (alert === null || alert === undefined || typeof alert !== 'object') {
    return alert;
  }

  const copy = { ...(alert as Record<string, unknown>) };
  for (const field of VISUALIZATION_ALERT_FIELDS) {
    if (field in copy) {
      copy[field] = null;
    }
  }
  return copy as A;
}

interface CaseLike {
  alert?: unknown;
  tasks?: Array<{ name?: string | null; investigationNotes?: string | null }>;
}

/** A case payload (as returned by findCaseById) redacted for a restricted viewer, with the level stamped on it. */
export function redactCaseForRestrictedView<C extends object>(caseData: C): C & { access_level: 'RESTRICTED' } {
  const { alert, tasks } = caseData as CaseLike;
  return {
    ...caseData,
    ...('alert' in caseData ? { alert: redactAlertForRestrictedView(alert) } : {}),
    ...(tasks ? { tasks: redactTasksForRestrictedView(tasks) } : {}),
    access_level: 'RESTRICTED',
  };
}
