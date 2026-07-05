import { determineSlaState, computeCaseSlaState } from '../src/modules/alert-priority/sla-state.util';
import { SlaState } from '@prisma/client-cms';

describe('sla-state.util', () => {
  const ratios = { dueSoonRatio: 0.2, atRiskRatio: 0.5 };
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const slaDueAt = new Date('2026-01-03T00:00:00.000Z'); // 48h budget

  describe('determineSlaState', () => {
    it('returns BREACHED once sla_due_at has passed, regardless of ratios', () => {
      const now = new Date('2026-01-03T00:00:01.000Z');
      expect(determineSlaState(createdAt, slaDueAt, now, ratios)).toBe(SlaState.BREACHED);
    });

    it('returns BREACHED exactly at the deadline (remaining == 0)', () => {
      expect(determineSlaState(createdAt, slaDueAt, slaDueAt, ratios)).toBe(SlaState.BREACHED);
    });

    it('returns ON_TRACK when well within the window', () => {
      const now = new Date('2026-01-01T06:00:00.000Z'); // 6h elapsed of 48h -> ratio 0.875
      expect(determineSlaState(createdAt, slaDueAt, now, ratios)).toBe(SlaState.ON_TRACK);
    });

    it('returns AT_RISK once remaining ratio drops to the at-risk threshold', () => {
      const now = new Date('2026-01-02T00:00:00.000Z'); // 24h elapsed of 48h -> ratio 0.5
      expect(determineSlaState(createdAt, slaDueAt, now, ratios)).toBe(SlaState.AT_RISK);
    });

    it('returns DUE_SOON once remaining ratio drops to the due-soon threshold', () => {
      const now = new Date('2026-01-02T14:24:00.000Z'); // remaining 9.6h of 48h -> ratio 0.2
      expect(determineSlaState(createdAt, slaDueAt, now, ratios)).toBe(SlaState.DUE_SOON);
    });

    it('applies tenant-specific ratios instead of any hardcoded default', () => {
      // 30h elapsed of 48h -> remaining ratio 0.375. Standard ratios (0.2/0.5) -> AT_RISK.
      const now = new Date('2026-01-02T06:00:00.000Z');
      const wideRatios = { dueSoonRatio: 0.4, atRiskRatio: 0.5 };

      expect(determineSlaState(createdAt, slaDueAt, now, ratios)).toBe(SlaState.AT_RISK);
      expect(determineSlaState(createdAt, slaDueAt, now, wideRatios)).toBe(SlaState.DUE_SOON);
    });

    it('treats a zero-or-negative total budget as DUE_SOON to avoid dividing by zero', () => {
      // Degenerate case: due date equal to created_at (zero-width budget), with `now`
      // still before it so the BREACHED check doesn't short-circuit first.
      const now = new Date('2025-12-31T23:00:00.000Z');
      expect(determineSlaState(createdAt, createdAt, now, ratios)).toBe(SlaState.DUE_SOON);
    });
  });

  describe('computeCaseSlaState', () => {
    it('returns null when the case has no sla_due_at', () => {
      expect(computeCaseSlaState({ created_at: createdAt, sla_due_at: null }, ratios)).toBeNull();
    });

    it('delegates to determineSlaState using the current time when sla_due_at is set', () => {
      const result = computeCaseSlaState({ created_at: createdAt, sla_due_at: slaDueAt }, ratios);
      expect(result).not.toBeNull();
      expect(Object.values(SlaState)).toContain(result);
    });
  });
});
