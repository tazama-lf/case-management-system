// Mirrors the backend's CasePriorityUtil fallback constants (case-priority.util.ts).
// Used only until the real tenant-specific thresholds load from
// GET /api/v1/cases/priority-thresholds, so the live preview never has a gap.
export const FALLBACK_HIGH_THRESHOLD = 0.7;
export const FALLBACK_MEDIUM_THRESHOLD = 0.4;
