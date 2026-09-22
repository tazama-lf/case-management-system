import { Inject, Injectable, NotFoundException, ForbiddenException, BadRequestException, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseInvestigator, CaseInvestigatorBlacklist, CaseInvestigatorMembership, TaskStatus } from '@prisma/client-cms';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { CacheService } from '../shared/cache.service';
import { Outcome } from '../../utils/types/outcome';

const INVESTIGATOR_ROLE = 'CMS_INVESTIGATOR';

// Case-level ACL — The one place membership logic lives; every other module that needs to
// know "can this investigator see this case" imports CaseInvestigatorModule
// and calls into this service rather than querying case_investigators /
// case_investigators_blacklist directly.
//
// Access is driven exclusively by task assignment. There is no manual-add path on the whitelist
// at all: `grant`/`demote`/`syncTaskAssignment` are called internally by
// the task lifecycle;

export interface SyncTaskAssignmentParams {
  taskId: number;
  previousAssigneeId?: string | null;
  newAssigneeId?: string | null;
  newStatus?: TaskStatus;
}

/** Payload for the 'case-investigator.access-removed' event - see unassignLiveTasks. */
export interface CaseInvestigatorAccessRemovedEvent {
  caseId: number;
  userId: string;
  tenantId: string;
  actorUserId: string;
  reason: string;
}

@Injectable()
export class CaseInvestigatorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => LoggingOrchestrationService))
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Only CMS_INVESTIGATOR targets may be revoked/blacklisted - supervisors/
   * compliance officers bypass the ACL in hasAccess() regardless, so
   * blacklisting one would leave a misleading row with no real effect.
   * Role comes from CacheService's Redis cache, not a live call. A cache
   * miss means unknown, not "safe" - fail closed.
   */
  private async assertTargetIsInvestigator(userId: string): Promise<void> {
    const role = await this.cacheService.getUserRole(userId);

    if (role === null) {
      throw new ForbiddenException(
        `Could not verify the role of user ${userId} (not found in the user cache) - refusing to revoke or blacklist until their role can be confirmed.`,
      );
    }

    if (role !== INVESTIGATOR_ROLE) {
      throw new ForbiddenException(`Cannot revoke or blacklist a ${role} - only investigators can be removed from a case.`);
    }
  }

  /**
   * Unassigns any live task this user holds on the case, as a consequence
   * of losing access. Emitted as an event rather than injecting
   * TaskLifecycleService directly, to avoid a circular module dependency
   * (see case-investigator.module.ts). emitAsync so this resolves only
   * once the listener finishes; its failure is still caught here too, so
   * an already-successful revoke/blacklist can't fail on cleanup.
   */
  private async unassignLiveTasks(caseId: number, userId: string, tenantId: string, actorUserId: string, reason: string): Promise<void> {
    try {
      await this.eventEmitter.emitAsync('case-investigator.access-removed', {
        caseId,
        userId,
        tenantId,
        actorUserId,
        reason,
      } satisfies CaseInvestigatorAccessRemovedEvent);
    } catch (error) {
      this.logger.error(
        `Task-unassign cascade failed after removing case-investigator access for ${userId} on case ${caseId}`,
        error,
        CaseInvestigatorService.name,
      );
    }
  }

  /**
   * true immediately for CMS_SUPERVISOR/CMS_COMPLIANCE_OFFICER (pure
   * bypass); for CMS_INVESTIGATOR, true iff a live
   * whitelist row exists.
   */
  async hasAccess(caseId: number, userId: string, tenantId: string, role: string): Promise<boolean> {
    if (role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER') {
      return true;
    }

    const liveRow = await this.prismaService.caseInvestigator.findFirst({
      where: {
        case_id: caseId,
        user_id: userId,
        tenant_id: tenantId,
        revoked_at: null,
      },
      select: { id: true },
    });

    return liveRow !== null;
  }

  /**
   * Gate for every read-path call site. Same
   * wording as evidence.service.ts's existing "not found or access denied"
   * so every gated read fails identically and doesn't leak case existence.
   */
  async assertReadAccess(caseId: number, userId: string, tenantId: string, role: string): Promise<void> {
    const allowed = await this.hasAccess(caseId, userId, tenantId, role);
    if (!allowed) {
      throw new NotFoundException('Case not found or access denied');
    }
  }

  /** Live whitelist case_ids for this user, tenant-scoped. For list-filtering call sites. */
  async getAccessibleCaseIds(userId: string, tenantId: string): Promise<number[]> {
    const rows = await this.prismaService.caseInvestigator.findMany({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        revoked_at: null,
      },
      select: { case_id: true },
    });

    return rows.map((row) => row.case_id);
  }

  /** The live blacklist row for (case, user), if any — lets refusal messages name who blocked and when. */
  async isBlacklisted(caseId: number, userId: string, tenantId: string): Promise<CaseInvestigatorBlacklist | null> {
    return await this.prismaService.caseInvestigatorBlacklist.findFirst({
      where: { case_id: caseId, user_id: userId, tenant_id: tenantId, unblocked_at: null },
    });
  }

  /**
   * Creates a live whitelist row if none exists; upgrades an existing row
   * to LEAD in place if the new grant is LEAD (never downgrades LEAD to
   * OBSERVER here — that's `demote`'s job only). Refuses if blacklisted.
   *
   * No controller endpoint calls this with caller-supplied input — it's
   * called exclusively, internally, by `syncTaskAssignment`. There is no
   * manual-add surface on the whitelist, for anyone, at any tier.
   */
  async grant(
    caseId: number,
    userId: string,
    tenantId: string,
    grantedBy: string,
    membership: CaseInvestigatorMembership = CaseInvestigatorMembership.OBSERVER,
  ): Promise<void> {
    try {
      await this.assertCaseInTenant(caseId, tenantId);

      const blocked = await this.isBlacklisted(caseId, userId, tenantId);
      if (blocked) {
        throw new ForbiddenException(
          `User is blacklisted on this case (blocked by ${blocked.blocked_by} at ${blocked.blocked_at.toISOString()}: ${blocked.block_reason}) — unblock first.`,
        );
      }

      const existing = await this.prismaService.caseInvestigator.findFirst({
        where: { case_id: caseId, user_id: userId, tenant_id: tenantId, revoked_at: null },
      });

      if (existing) {
        if (membership === CaseInvestigatorMembership.LEAD && existing.membership !== CaseInvestigatorMembership.LEAD) {
          await this.prismaService.caseInvestigator.update({
            where: { id: existing.id },
            data: { membership: CaseInvestigatorMembership.LEAD },
          });
        }
        return;
      }

      await this.prismaService.caseInvestigator.create({
        data: {
          case_id: caseId,
          tenant_id: tenantId,
          user_id: userId,
          membership,
          granted_by: grantedBy,
        },
      });
    } catch (error) {
      this.logger.error(`Error granting case-investigator access for case ${caseId}, user ${userId}`, error, CaseInvestigatorService.name);
      throw error;
    }
  }

  /**
   * LEAD -> OBSERVER in place, if a live row exists and is currently LEAD.
   * No-op otherwise. NOT a revoke — same row, no revoked_at/revoked_by/
   * revoke_reason touched, no mandatory reason, since access itself isn't
   * changing, only the tier label. Used only for the completion path  — reassignment/unassignment away uses `revoke`, not this.
   */
  async demote(caseId: number, userId: string, tenantId: string): Promise<void> {
    const existing = await this.prismaService.caseInvestigator.findFirst({
      where: { case_id: caseId, user_id: userId, tenant_id: tenantId, revoked_at: null },
    });

    if (existing?.membership !== CaseInvestigatorMembership.LEAD) {
      return;
    }

    await this.prismaService.caseInvestigator.update({
      where: { id: existing.id },
      data: { membership: CaseInvestigatorMembership.OBSERVER },
    });
  }

  /**
   * True if `userId` currently holds any OTHER non-completed task on
   * `caseId` (task_id != excludingTaskId). No ownership fallback — task
   * assignment is the only source of truth. Called by
   * `syncTaskAssignment` before choosing "leave alone" / `demote` / `revoke`.
   *
   * tenant_id is included in the WHERE even though every caller today
   * already derives caseId from a task row it just wrote (so a
   * cross-tenant caseId can't actually reach here in practice, unlike the
   * grant/revoke/blacklist bug this fix rides along with) — added anyway
   * for defense-in-depth and consistency with every other query in this
   * service now filtering by tenant_id directly instead of trusting
   * case_id alone.
   */
  async hasOtherLiveClaimOnCase(caseId: number, userId: string, tenantId: string, excludingTaskId: number): Promise<boolean> {
    const count = await this.prismaService.task.count({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
        assigned_user_id: userId,
        task_id: { not: excludingTaskId },
        status: { not: TaskStatus.STATUS_30_COMPLETED },
      },
    });

    return count > 0;
  }

  /**
   * The one entry point every task-mutating call site uses. Composes
   * grant/demote/revoke/hasOtherLiveClaimOnCase/blacklist-refusal so this
   * logic lives in exactly one place instead of being re-implemented at
   * each of the six task write call sites.
   *
   * Expected to be called AFTER the task write succeeds (so before/after
   * values reflect what was actually persisted), and — once wired — inside
   * the same transaction as that write, so a blacklist-refusal here also
   * rolls back the task assignment itself rather than leaving the task
   * assigned but the ACL grant silently skipped.
   */
  async syncTaskAssignment(caseId: number, tenantId: string, actingUserId: string, params: SyncTaskAssignmentParams): Promise<void> {
    const { taskId, previousAssigneeId, newAssigneeId, newStatus } = params;

    if (newAssigneeId && newAssigneeId !== previousAssigneeId) {
      await this.grant(caseId, newAssigneeId, tenantId, actingUserId, CaseInvestigatorMembership.LEAD);
    }

    if (previousAssigneeId && previousAssigneeId !== newAssigneeId) {
      // Reassignment / unassignment / claim-away.
      const stillHasClaim = await this.hasOtherLiveClaimOnCase(caseId, previousAssigneeId, tenantId, taskId);
      if (!stillHasClaim) {
        await this.performRevoke(
          caseId,
          previousAssigneeId,
          tenantId,
          actingUserId,
          'Automatically revoked: no longer assigned to any task on this case',
        );
      }
      return;
    }

    if (newStatus === TaskStatus.STATUS_30_COMPLETED && newAssigneeId) {
      // Completion, assignee unchanged.
      const stillHasClaim = await this.hasOtherLiveClaimOnCase(caseId, newAssigneeId, tenantId, taskId);
      if (!stillHasClaim) {
        await this.demote(caseId, newAssigneeId, tenantId);
      }
    }
  }

  /**
   * Supervisor+ only, mandatory reason. Investigator-only target (see
   * assertTargetIsInvestigator). Soft-remove — user can be re-added later
   * by a fresh task assignment, not by hand. Cascades: any live task this
   * user holds on the case gets unassigned too.
   */
  async revoke(caseId: number, userId: string, tenantId: string, revokedBy: string, reason: string): Promise<void> {
    await this.assertTargetIsInvestigator(userId);
    await this.performRevoke(caseId, userId, tenantId, revokedBy, reason);
    await this.unassignLiveTasks(caseId, userId, tenantId, revokedBy, `Investigator access revoked: ${reason}`);
  }

  /**
   * Raw revoke DB operation, no role check or cascade. Used by revoke()
   * above and by syncTaskAssignment's automatic cleanup - task assignment
   * doesn't enforce an investigator-only assignee, so gating this
   * bookkeeping path on assertTargetIsInvestigator could throw on a
   * legitimate auto-cleanup rather than a deliberate decision.
   */
  private async performRevoke(caseId: number, userId: string, tenantId: string, revokedBy: string, reason: string): Promise<void> {
    this.assertReason(reason, 'Reason for revocation');

    try {
      const existing = await this.prismaService.caseInvestigator.findFirst({
        where: { case_id: caseId, user_id: userId, tenant_id: tenantId, revoked_at: null },
      });

      if (!existing) {
        throw new NotFoundException('No live whitelist entry found for this user on this case');
      }

      await this.prismaService.caseInvestigator.update({
        where: { id: existing.id },
        data: { revoked_at: new Date(), revoked_by: revokedBy, revoke_reason: reason },
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: revokedBy,
          actionPerformed: `Revoked case-investigator access for ${userId}: ${reason}`,
          entityName: CaseInvestigatorService.name,
          operation: 'revokeCaseInvestigator',
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        caseId,
        tenantId,
      );
    } catch (error) {
      this.logger.error(`Error revoking case-investigator access for case ${caseId}, user ${userId}`, error, CaseInvestigatorService.name);
      throw error;
    }
  }

  /**
   * Supervisor+ only, mandatory reason. Investigator-only target (see
   * assertTargetIsInvestigator). One transaction: revoke any live
   * whitelist row (revoke_reason = 'blacklisted'), then write the
   * blacklist row. Future task assignments refuse until unblocked.
   * Cascades: any live task this user holds on the case gets unassigned too.
   */
  async blacklist(caseId: number, userId: string, tenantId: string, blockedBy: string, reason: string): Promise<void> {
    await this.assertTargetIsInvestigator(userId);
    this.assertReason(reason, 'Reason for blacklisting');

    try {
      await this.assertCaseInTenant(caseId, tenantId);

      await this.prismaService.$transaction(async (tx) => {
        const existing = await tx.caseInvestigator.findFirst({
          where: { case_id: caseId, user_id: userId, tenant_id: tenantId, revoked_at: null },
        });

        if (existing) {
          await tx.caseInvestigator.update({
            where: { id: existing.id },
            data: { revoked_at: new Date(), revoked_by: blockedBy, revoke_reason: 'blacklisted' },
          });
        }

        await tx.caseInvestigatorBlacklist.create({
          data: {
            case_id: caseId,
            tenant_id: tenantId,
            user_id: userId,
            blocked_by: blockedBy,
            block_reason: reason,
          },
        });
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: blockedBy,
          actionPerformed: `Blacklisted ${userId} from this case: ${reason}`,
          entityName: CaseInvestigatorService.name,
          operation: 'blacklistCaseInvestigator',
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        caseId,
        tenantId,
      );

      await this.unassignLiveTasks(caseId, userId, tenantId, blockedBy, `Investigator blacklisted: ${reason}`);
    } catch (error) {
      this.logger.error(`Error blacklisting user ${userId} on case ${caseId}`, error, CaseInvestigatorService.name);
      throw error;
    }
  }

  /**
   * Supervisor+ only, mandatory reason. Soft-update — does NOT grant
   * access back; a subsequent task assignment is still required for the
   * person to reappear on the whitelist.
   */
  async unblock(caseId: number, userId: string, tenantId: string, unblockedBy: string, reason: string): Promise<void> {
    this.assertReason(reason, 'Reason for unblocking');

    try {
      const existing = await this.prismaService.caseInvestigatorBlacklist.findFirst({
        where: { case_id: caseId, user_id: userId, tenant_id: tenantId, unblocked_at: null },
      });

      if (!existing) {
        throw new NotFoundException('No live blacklist entry found for this user on this case');
      }

      await this.prismaService.caseInvestigatorBlacklist.update({
        where: { id: existing.id },
        data: { unblocked_at: new Date(), unblocked_by: unblockedBy, unblock_reason: reason },
      });

      await this.loggingOrchestrationService.logActionsWithHistory(
        {
          userId: unblockedBy,
          actionPerformed: `Unblocked ${userId} on this case: ${reason}`,
          entityName: CaseInvestigatorService.name,
          operation: 'unblockCaseInvestigator',
          outcome: Outcome.SUCCESS,
          tenantId,
        },
        caseId,
        tenantId,
      );
    } catch (error) {
      this.logger.error(`Error unblocking user ${userId} on case ${caseId}`, error, CaseInvestigatorService.name);
      throw error;
    }
  }

  /** Live whitelist rows for a case, tenant-scoped. */
  async listWhitelist(caseId: number, tenantId: string): Promise<CaseInvestigator[]> {
    return await this.prismaService.caseInvestigator.findMany({
      where: { case_id: caseId, tenant_id: tenantId, revoked_at: null },
      orderBy: { granted_at: 'asc' },
    });
  }

  /** Live blacklist rows for a case, tenant-scoped. */
  async listBlacklist(caseId: number, tenantId: string): Promise<CaseInvestigatorBlacklist[]> {
    return await this.prismaService.caseInvestigatorBlacklist.findMany({
      where: { case_id: caseId, tenant_id: tenantId, unblocked_at: null },
      orderBy: { blocked_at: 'asc' },
    });
  }

  private assertReason(reason: string, fieldLabel: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException(`${fieldLabel} is required`);
    }
  }

  /**
   * `grant`/`blacklist` are the two methods that CREATE a new row, trusting
   * the caller's `tenantId` verbatim to stamp onto it. Unlike `revoke`/
   * `demote`/`unblock` (which only UPDATE a row already found via a
   * tenant-filtered lookup, so a cross-tenant caseId simply finds nothing),
   * a create path with no check would happily write a row for a real
   * caseId under the WRONG tenant_id if the caller's caseId doesn't
   * actually belong to their own tenant — not a read/write access leak
   * (later reads still filter by the case's real tenant), but a real
   * data-integrity gap and a guessable-case_id nuisance-write surface.
   * Same "not found" wording as everywhere else — doesn't leak whether
   * the case exists in a different tenant.
   */
  private async assertCaseInTenant(caseId: number, tenantId: string): Promise<void> {
    const caseRow = await this.prismaService.case.findFirst({
      where: { case_id: caseId, tenant_id: tenantId },
      select: { case_id: true },
    });

    if (!caseRow) {
      throw new NotFoundException('Case not found or access denied');
    }
  }
}
