import { CaseStatus } from '@prisma/client-cms';

export function isCaseEligibleForInProgress(status: CaseStatus): boolean {
  const eligibleStatuses: CaseStatus[] = [
    CaseStatus.STATUS_10_ASSIGNED,
    CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    CaseStatus.STATUS_03_RETURNED,
  ];

  return eligibleStatuses.includes(status);
}
