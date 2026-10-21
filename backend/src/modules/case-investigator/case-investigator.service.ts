import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseInvestigator, CaseInvestigatorBlacklist, CaseInvestigatorMembership, CaseStatus, TaskStatus } from '@prisma/client-cms';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { CacheService } from '../shared/cache.service';
import { Outcome } from '../../utils/types/outcome';

const INVESTIGATOR_ROLE = 'CMS_INVESTIGATOR';
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

// Unclaimed cases every investigator can see and claim (same set ReportsService treats as visible to all).
const OPEN_FOR_CLAIM_STATUSES: CaseStatus[] = [CaseStatus.STATUS_00_DRAFT, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT];

/** A whitelist row plus its user's role (null = unknown). */
export type CaseInvestigatorWithRole = CaseInvestigator & { user_role: string | null };

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
   * Tells connected dashboards (via CaseEventsGateway) that who can see this case changed, so the
   * affected investigator's queue refreshes without a manual reload. Without it a blacklist or revoke
   * on a case with no task to unassign - which is the only thing that otherwise emits a case event -
   * leaves the case sitting in their list until they reload. Never throws: the access change itself
   * has already been committed.
   */
  private notifyAccessChanged(caseId: number, tenantId: string): void {
    try {
      this.eventEmitter.emit('case.access-changed', { caseId, tenantId });
    } catch (error) {
      this.logger.error(`Failed to emit case.access-changed for case ${caseId}`, error, CaseInvestigatorService.name);
    }
  }

  /**
   * true immediately for CMS_SUPERVISOR/CMS_COMPLIANCE_OFFICER (pure
   * bypass); for CMS_INVESTIGATOR, true iff a live whitelist row exists,
   * or the case is still open for claiming (DRAFT / READY_FOR_ASSIGNMENT —
   * nobody has been assigned yet, so no whitelist row can exist) and the
   * user isn't blacklisted on it.
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

    if (liveRow !== null) {
      return true;
    }

    const openCase = await this.prismaService.case.findFirst({
      where: { case_id: caseId, tenant_id: tenantId, status: { in: OPEN_FOR_CLAIM_STATUSES } },
      select: { case_id: true },
    });

    if (!openCase) {
      return await this.hasCreatorAccess(caseId, userId, tenantId);
    }

    return (await this.isBlacklisted(caseId, userId, tenantId)) === null;
  }

  /**
   * The user created this case (case_creator_user_id) and has not been blacklisted or revoked from
   * it. Covers cases that sit pending creation approval: the creator holds no task on them yet (the
   * only task is the supervisor's unassigned "Approve Case Creation"), so neither a whitelist row nor
   * an open-for-claim status would otherwise let them see the case they just submitted.
   */
  private async hasCreatorAccess(caseId: number, userId: string, tenantId: string): Promise<boolean> {
    const created = await this.prismaService.case.findFirst({
      where: { case_id: caseId, tenant_id: tenantId, case_creator_user_id: userId },
      select: { case_id: true },
    });
    if (!created) {
      return false;
    }

    if ((await this.isBlacklisted(caseId, userId, tenantId)) !== null) {
      return false;
    }

    const revoked = await this.prismaService.caseInvestigator.findFirst({
      where: { case_id: caseId, user_id: userId, tenant_id: tenantId, revoked_at: { not: null } },
      select: { id: true },
    });
    return revoked === null;
  }

  /** Ids of cases this user created, minus any they were blacklisted or revoked from. */
  private async getCreatedCaseIds(userId: string, tenantId: string): Promise<number[]> {
    const created = await this.prismaService.case.findMany({
      where: { tenant_id: tenantId, case_creator_user_id: userId },
      select: { case_id: true },
    });
    if (created.length === 0) {
      return [];
    }

    const caseIds = created.map((row) => row.case_id);
    const [blocked, revoked] = await Promise.all([
      this.prismaService.caseInvestigatorBlacklist.findMany({
        where: { tenant_id: tenantId, user_id: userId, case_id: { in: caseIds }, unblocked_at: null },
        select: { case_id: true },
      }),
      this.prismaService.caseInvestigator.findMany({
        where: { tenant_id: tenantId, user_id: userId, case_id: { in: caseIds }, revoked_at: { not: null } },
        select: { case_id: true },
      }),
    ]);
    const excluded = new Set([...blocked, ...revoked].map((row) => row.case_id));
    return caseIds.filter((caseId) => !excluded.has(caseId));
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

  /**
   * Case ids this user may open on the strength of their own record, tenant-scoped: live whitelist
   * rows plus cases they created (see hasCreatorAccess). For list-filtering call sites.
   */
  async getAccessibleCaseIds(userId: string, tenantId: string): Promise<number[]> {
    const rows = await this.prismaService.caseInvestigator.findMany({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        revoked_at: null,
      },
      select: { case_id: true },
    });
    const createdCaseIds = await this.getCreatedCaseIds(userId, tenantId);

    return [...new Set([...rows.map((row) => row.case_id), ...createdCaseIds])];
  }

  /**
   * For tenant-wide list endpoints that have no single caseId to assert on.
   * Returns `null` for CMS_SUPERVISOR/CMS_COMPLIANCE_OFFICER (same bypass as
   * hasAccess — no filter needed). CMS_INVESTIGATOR gets its live whitelist
   * case_ids plus every case still open for claiming (DRAFT /
   * READY_FOR_ASSIGNMENT) that it isn't blacklisted on, mirroring hasAccess.
   * Any other role fails closed to its own whitelist rather than seeing the
   * whole tenant.
   */
  async getCaseIdScope(userId: string, tenantId: string, role: string): Promise<number[] | null> {
    if (role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER') {
      return null;
    }

    const whitelisted = await this.getAccessibleCaseIds(userId, tenantId);
    if (role !== 'CMS_INVESTIGATOR') {
      return whitelisted;
    }

    const blacklisted = await this.getBlacklistedCaseIds(userId, tenantId);
    const openCases = await this.prismaService.case.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: OPEN_FOR_CLAIM_STATUSES },
        ...(blacklisted.length > 0 && { case_id: { notIn: blacklisted } }),
      },
      select: { case_id: true },
    });

    return [...new Set([...whitelisted, ...openCases.map((row) => row.case_id)])];
  }

  /** The live blacklist row for (case, user), if any — lets refusal messages name who blocked and when. */
  async isBlacklisted(caseId: number, userId: string, tenantId: string): Promise<CaseInvestigatorBlacklist | null> {
    return await this.prismaService.caseInvestigatorBlacklist.findFirst({
      where: { case_id: caseId, user_id: userId, tenant_id: tenantId, unblocked_at: null },
    });
  }

  /**
   * Bulk counterpart to `isBlacklisted`, for list-filtering call sites
   * (getAllCases / checkUserCaseAccess) that need to exclude every case this
   * user is currently blacklisted on from their visibility OR — mirroring
   * `hasAccess`'s own blacklist check for the open-for-claim branch, so a
   * case list can't surface (with its embedded alert/transaction data) a
   * case the detail/read gate would otherwise 404 on.
   */
  /**
   * Cases this user was revoked from and has not been re-granted since (no live whitelist row). A
   * revoked investigator must lose the case from their lists as well as from the detail gate; without
   * this they kept seeing it - through a task still assigned to them from before the revoke - and then
   * got a 404 on opening it.
   */
  async getRevokedCaseIds(userId: string, tenantId: string): Promise<number[]> {
    const revoked = await this.prismaService.caseInvestigator.findMany({
      where: { user_id: userId, tenant_id: tenantId, revoked_at: { not: null } },
      select: { case_id: true },
    });
    if (revoked.length === 0) {
      return [];
    }

    const caseIds = [...new Set(revoked.map((row) => row.case_id))];
    const live = await this.prismaService.caseInvestigator.findMany({
      where: { user_id: userId, tenant_id: tenantId, revoked_at: null, case_id: { in: caseIds } },
      select: { case_id: true },
    });
    const liveSet = new Set(live.map((row) => row.case_id));
    return caseIds.filter((caseId) => !liveSet.has(caseId));
  }

  async getBlacklistedCaseIds(userId: string, tenantId: string): Promise<number[]> {
    const rows = await this.prismaService.caseInvestigatorBlacklist.findMany({
      where: { user_id: userId, tenant_id: tenantId, unblocked_at: null },
      select: { case_id: true },
    });

    return rows.map((row) => row.case_id);
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
   * Write-side gate for case mutations that have no owner check of their own
   * (PUT /cases/:caseId, abandon, complete-draft). Mirrors the task rule: if
   * nobody currently holds the case it is open, but once someone holds a live
   * (non-completed) task on it, only a holder — or a supervisor/compliance
   * officer — may modify it. "Holder" is derived from tasks, never from
   * Case.case_owner_user_id (see the plan: that column is written from
   * unrelated places). A draft's creator is its holder, since "Complete New
   * Case" is assigned to them at creation.
   *
   * Someone with no read access gets the same 404 as every gated read; someone
   * who can see the case but isn't its holder (e.g. a past OBSERVER) gets a 403.
   */
  async assertCanModifyCase(caseId: number, userId: string, tenantId: string, role: string): Promise<void> {
    if (role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER') {
      return;
    }

    const holders = await this.prismaService.task.findMany({
      where: {
        case_id: caseId,
        tenant_id: tenantId,
        assigned_user_id: { not: null },
        status: { not: TaskStatus.STATUS_30_COMPLETED },
      },
      select: { assigned_user_id: true },
      distinct: ['assigned_user_id'],
    });

    if (holders.some((holder) => holder.assigned_user_id === userId)) {
      // Holding a live task doesn't override a blacklist - a blocked user must not modify the case.
      if ((await this.isBlacklisted(caseId, userId, tenantId)) !== null) {
        throw new NotFoundException('Case not found or access denied');
      }
      return;
    }

    // Either the case is open (no current holder at all) or it's held by someone else - either
    // way the caller still needs to be able to see this case before being allowed to write to
    // it. Without this, "the case is open" alone let anyone (including a caller with no access
    // to the case at all - wrong tenant, blacklisted, or just not a member) through unconditionally.
    if (!(await this.hasAccess(caseId, userId, tenantId, role))) {
      throw new NotFoundException('Case not found or access denied');
    }

    if (holders.length === 0) {
      return;
    }

    throw new ForbiddenException('This case is held by another investigator - only its current holder or a supervisor can modify it.');
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
    this.notifyAccessChanged(caseId, tenantId);
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

      try {
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
      } catch (error) {
        // A concurrent blacklist won the race against the live-row unique index; the transaction has already rolled back.
        if ((error as { code?: string }).code === UNIQUE_CONSTRAINT_VIOLATION) {
          throw new ConflictException('User is already blacklisted on this case');
        }
        throw error;
      }

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
      this.notifyAccessChanged(caseId, tenantId);
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

      this.notifyAccessChanged(caseId, tenantId);
    } catch (error) {
      this.logger.error(`Error unblocking user ${userId} on case ${caseId}`, error, CaseInvestigatorService.name);
      throw error;
    }
  }

  /**
   * Live whitelist rows for a case, tenant-scoped, each tagged with the user's
   * role so the Access screen can tell which rows can actually be revoked or
   * blacklisted. Supervisors and compliance officers can land on the whitelist
   * (task assignment doesn't filter by role) but revoke/blacklist refuse them
   * (assertTargetIsInvestigator), so the UI must not offer those actions.
   * Role comes from the same cache assertTargetIsInvestigator uses; a miss or
   * cache failure is `null` (unknown), never guessed.
   */
  async listWhitelist(caseId: number, tenantId: string): Promise<CaseInvestigatorWithRole[]> {
    const rows = await this.prismaService.caseInvestigator.findMany({
      where: { case_id: caseId, tenant_id: tenantId, revoked_at: null },
      orderBy: { granted_at: 'asc' },
    });

    const roles = new Map<string, string | null>();
    await Promise.all(
      [...new Set(rows.map((row) => row.user_id))].map(async (userId) => {
        try {
          roles.set(userId, await this.cacheService.getUserRole(userId));
        } catch {
          roles.set(userId, null);
        }
      }),
    );

    return rows.map((row) => ({ ...row, user_role: roles.get(row.user_id) ?? null }));
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
