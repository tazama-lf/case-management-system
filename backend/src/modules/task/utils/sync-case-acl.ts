import { setTimeout as sleep } from 'node:timers/promises';
import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { CaseInvestigatorService, SyncTaskAssignmentParams } from '../../case-investigator/case-investigator.service';

// Waits between attempts: 3 retries after the first try, so a brief database / cache hiccup is ridden out.
const RETRY_DELAYS_MS = [100, 300, 900];

/**
 * The one place task writes sync the case ACL (allowlist) afterwards. Best-effort: the task mutation has
 * already committed, so a failure here never fails the caller. A failed sync is retried a few times first -
 * syncTaskAssignment is safe to re-run (grants skip existing rows, a revoke of an already-revoked row is a
 * no-op) and re-derives the state from the same task transition, so a retry preserves the reassignment /
 * unassignment. It only ever uses syncTaskAssignment, never the manual revoke flow or its cascade.
 */
export async function syncCaseAcl(
  caseInvestigatorService: CaseInvestigatorService,
  logger: LoggerService,
  loggerContext: string,
  caseId: number,
  tenantId: string,
  actingUserId: string,
  params: SyncTaskAssignmentParams,
  retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
  attempt = 0,
): Promise<void> {
  try {
    await caseInvestigatorService.syncTaskAssignment(caseId, tenantId, actingUserId, params);
  } catch (error) {
    if (attempt < retryDelaysMs.length) {
      await sleep(retryDelaysMs[attempt]);
      await syncCaseAcl(caseInvestigatorService, logger, loggerContext, caseId, tenantId, actingUserId, params, retryDelaysMs, attempt + 1);
      return;
    }
    logger.warn(
      `Case-investigator ACL sync failed for case ${caseId}, task ${params.taskId} after ${attempt + 1} attempts (task mutation itself already succeeded): ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
      loggerContext,
    );
  }
}
