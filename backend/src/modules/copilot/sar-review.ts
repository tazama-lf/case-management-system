/**
 * Review workflow for a SAR/STR draft (CIMS Part 2, 2.4.1): the investigator or compliance officer reviews the
 * draft and submits it, a supervisor approves or returns it, and only an approved draft can be filed.
 * Events are append-only; the status is derived from them, so the history is the audit trail.
 */
export type ReviewAction = 'SUBMIT' | 'APPROVE' | 'RETURN' | 'WITHDRAW' | 'FILE';
export type ReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'RETURNED' | 'APPROVED' | 'FILED';
export type ReviewRole = 'maker' | 'checker';

export interface ReviewEvent {
  id: number;
  draftId: number;
  action: ReviewAction;
  actorId: string;
  actorName: string;
  role: ReviewRole;
  comment: string;
  reference?: string;
  at: string;
}

const NEEDS_COMMENT: ReviewAction[] = ['RETURN'];

/** Which actions a status allows, and which role may take them. */
const TRANSITIONS: Record<ReviewStatus, Partial<Record<ReviewAction, { role: ReviewRole; to: ReviewStatus }>>> = {
  DRAFT: { SUBMIT: { role: 'maker', to: 'IN_REVIEW' } },
  RETURNED: { SUBMIT: { role: 'maker', to: 'IN_REVIEW' } },
  IN_REVIEW: {
    APPROVE: { role: 'checker', to: 'APPROVED' },
    RETURN: { role: 'checker', to: 'RETURNED' },
    WITHDRAW: { role: 'maker', to: 'DRAFT' },
  },
  APPROVED: { FILE: { role: 'maker', to: 'FILED' } },
  FILED: {},
};

export function statusOf(events: Array<Pick<ReviewEvent, 'action'>>): ReviewStatus {
  return events.reduce<ReviewStatus>((status, e) => TRANSITIONS[status][e.action]?.to ?? status, 'DRAFT');
}

export interface Allowed {
  action: ReviewAction;
  role: ReviewRole;
}

export function allowedActions(status: ReviewStatus): Allowed[] {
  return Object.entries(TRANSITIONS[status]).map(([action, t]) => ({ action: action as ReviewAction, role: t.role }));
}

/** Why an action cannot be taken now, or null. A supervisor who submitted the draft cannot approve it. */
export function refusal(
  events: ReviewEvent[],
  action: ReviewAction,
  actor: { id: string; role: ReviewRole },
  comment: string,
  reference?: string,
): string | null {
  const status = statusOf(events);
  const t = TRANSITIONS[status][action];
  if (!t) return `The draft is ${status.replace('_', ' ').toLowerCase()}; that step is not available now.`;
  if (t.role !== actor.role) {
    return `Only a ${t.role === 'checker' ? 'supervisor' : 'investigator or compliance officer'} can ${action.toLowerCase()} the draft.`;
  }
  if (action === 'APPROVE' || action === 'RETURN') {
    const submitter = [...events].reverse().find((e) => e.action === 'SUBMIT');
    if (submitter?.actorId === actor.id) return 'The person who submitted the draft cannot review it.';
  }
  if (NEEDS_COMMENT.includes(action) && !comment.trim()) return 'Say what needs to change.';
  if (action === 'FILE' && !reference?.trim()) return 'Enter the FIU acknowledgement or reference number.';
  return null;
}
