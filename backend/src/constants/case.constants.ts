import { CaseStatus } from '@prisma/client-cms';

/**
 * Valid case closure outcomes
 */
export const CASE_CLOSURE_OUTCOMES = ['STATUS_81_CLOSED_REFUTED', 'STATUS_82_CLOSED_CONFIRMED', 'STATUS_83_CLOSED_INCONCLUSIVE'] as const;

/**
 * Closed case statuses (final states)
 */
export const CLOSED_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.STATUS_81_CLOSED_REFUTED,
  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
  CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
];

/**
 * Allowed states for case reopening
 */
export const REOPENABLE_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
  CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
  CaseStatus.STATUS_81_CLOSED_REFUTED,
  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
];

/**
 * Non-active case statuses (excluded from workload stats)
 */
export const INACTIVE_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.STATUS_81_CLOSED_REFUTED,
  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
  CaseStatus.STATUS_99_ABANDONED,
];

/**
 * Task name constants
 */
export const TASK_NAMES = {
  INVESTIGATE_CASE: 'Investigate Case',
  INVESTIGATE_CASE_LOWER: 'Investigate case',
  INVESTIGATE_CASE_VARIANTS: ['Investigate Case', 'Investigate Fraud', 'Investigate AML'],
  INVESTIGATE_FRAUD: 'Investigate Fraud',
  INVESTIGATE_AML: 'Investigate AML',
  APPROVE_CASE_CREATION: 'Approve Case Creation',
  APPROVE_CASE_CLOSURE: 'Approve Case Closure',
  APPROVE_CASE_CLOSURE_LOWER: 'Approve case closure',
  APPROVE_CASE_CLOSURE_VARIANTS: ['Approve Case Closure', 'Approve case closure', 'approve case closure'],
  APPROVE_CASE_REOPENING: 'Approve Case Reopening',
  COMPLETE_NEW_CASE: 'Complete New Case',
} as const;

/**
 * Candidate group constants
 */
export const CANDIDATE_GROUPS = {
  INVESTIGATIONS: 'investigations',
  SUPERVISORS: 'supervisors',
} as const;

/**
 * Minimum length requirements
 */
export const VALIDATION_LENGTHS = {
  MIN_FINAL_NOTES: 4,
  MIN_REJECTION_REASON: 4,
  MIN_REOPENING_REASON: 4,
} as const;

/**
 * Role constants for investigators and analysts
 */
export const INVESTIGATOR_ROLES = ['ANALYST', 'INVESTIGATOR', 'CMS_INVESTIGATOR'] as const;
