import { SlaState } from '@prisma/client-cms';
import type { SlaEscalationRatios } from '../shared/utils/sla-policy.util';

/**
 * Pure, derived SLA state. Never persisted on Case — recomputed at read time
 * from sla_due_at vs now, so it can't go stale.
 *
 * "Budget" is the full window from when the SLA clock started to the deadline
 * (slaStartedAt -> slaDueAt), not from case creation — a case can sit in DRAFT or
 * PENDING_CASE_CREATION_APPROVAL for a while before the clock starts at
 * STATUS_02_READY_FOR_ASSIGNMENT, and that dead time must not dilute the ratio.
 * The thresholds compare how much of that window remains, not an absolute duration,
 * so the same ratios apply consistently across LOW/MEDIUM/HIGH priority cases with
 * very different total windows. Ratios are tenant-configurable (SlaEscalationThreshold)
 * — callers resolve them once per request/tenant via SlaPolicyUtil.getEscalationRatios
 * and pass the plain numbers in here, so this stays a cheap, synchronous, pure function
 * safe to call per-row in a list rather than triggering a DB lookup per case.
 */
export function determineSlaState(slaStartedAt: Date, slaDueAt: Date, now: Date, ratios: SlaEscalationRatios): SlaState {
  const remainingMs = slaDueAt.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return SlaState.BREACHED;
  }

  const totalBudgetMs = slaDueAt.getTime() - slaStartedAt.getTime();
  if (totalBudgetMs <= 0) {
    return SlaState.DUE_SOON;
  }

  const remainingRatio = remainingMs / totalBudgetMs;
  if (remainingRatio <= ratios.dueSoonRatio) {
    return SlaState.DUE_SOON;
  }
  if (remainingRatio <= ratios.atRiskRatio) {
    return SlaState.AT_RISK;
  }
  return SlaState.ON_TRACK;
}

/**
 * Convenience wrapper for API responses: cases without an sla_due_at (never reached
 * READY_FOR_ASSIGNMENT yet, or terminal) or without an sla_started_at (legacy case that
 * predates this column, not yet migrated by a fresh RFA entry) have no meaningful SLA state.
 */
export function computeCaseSlaState(
  caseData: { sla_started_at: Date | null; sla_due_at: Date | null },
  ratios: SlaEscalationRatios,
): SlaState | null {
  if (!caseData.sla_due_at || !caseData.sla_started_at) {
    return null;
  }
  return determineSlaState(caseData.sla_started_at, caseData.sla_due_at, new Date(), ratios);
}
