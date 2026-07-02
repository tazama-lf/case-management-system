import { SlaState } from '@prisma/client-cms';

const DUE_SOON_REMAINING_RATIO = 0.2;
const AT_RISK_REMAINING_RATIO = 0.5;

/**
 * Pure, derived SLA state. Never persisted on Case — recomputed at read time
 * from sla_due_at vs now, so it can't go stale.
 *
 * "Budget" is the full window from creation to the deadline (createdAt -> slaDueAt);
 * the thresholds compare how much of that window remains, not an absolute duration,
 * so the same ratios apply consistently across LOW/MEDIUM/HIGH priority cases with
 * very different total windows.
 */
export function determineSlaState(createdAt: Date, slaDueAt: Date, now: Date): SlaState {
  const remainingMs = slaDueAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return SlaState.BREACHED;
  }

  const totalBudgetMs = slaDueAt.getTime() - createdAt.getTime();
  if (totalBudgetMs <= 0) {
    return SlaState.DUE_SOON;
  }

  const remainingRatio = remainingMs / totalBudgetMs;
  if (remainingRatio <= DUE_SOON_REMAINING_RATIO) {
    return SlaState.DUE_SOON;
  }
  if (remainingRatio <= AT_RISK_REMAINING_RATIO) {
    return SlaState.AT_RISK;
  }
  return SlaState.ON_TRACK;
}

/**
 * Convenience wrapper for API responses: cases without an sla_due_at (e.g. legacy
 * closed cases from before this feature) have no meaningful SLA state.
 */
export function computeCaseSlaState(caseData: { created_at: Date; sla_due_at: Date | null }): SlaState | null {
  if (!caseData.sla_due_at) {
    return null;
  }
  return determineSlaState(caseData.created_at, caseData.sla_due_at, new Date());
}
