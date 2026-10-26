import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseInvestigatorService } from '../src/modules/case-investigator/case-investigator.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { CacheService } from '../src/modules/shared/cache.service';
import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { CaseInvestigatorMembership, CaseStatus, TaskStatus } from '@prisma/client-cms';

const TENANT = 'tenant-123';
const CASE_ID = 1;
const USER_ID = 'user-111';
const OTHER_USER_ID = 'user-222';
const GRANTED_BY = 'granter-333';
const BLOCKED_BY = 'blocker-444';

describe('CaseInvestigatorService', () => {
  let service: CaseInvestigatorService;
  let prisma: any;
  let logger: any;
  let loggingOrchestrationService: any;
  let cacheService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    const mockPrisma = {
      caseInvestigator: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      caseInvestigatorBlocklist: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      case: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      task: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    // blocklist() runs its work inside `this.prismaService.$transaction(async (tx) => ...)`
    // — reuse the same top-level mocks as `tx` so tests can set expectations
    // on the same jest.fn() instances regardless of which path wrote them.
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActionsWithHistory: jest.fn().mockResolvedValue(undefined),
    };

    // revoke/blocklist only reach the DB once the target's cached role
    // passes assertTargetIsInvestigator - default to a live investigator
    // target so every existing revoke/blocklist test still exercises the
    // same behavior it did before that guard existed. Role-guard behavior
    // itself is covered by its own dedicated tests below.
    const mockCacheService = {
      getUserRole: jest.fn().mockResolvedValue('CMS_INVESTIGATOR'),
    };

    // revoke/blocklist emit 'case-investigator.access-removed' (via emitAsync)
    // rather than calling TaskLifecycleService directly - see the docstring
    // on unassignLiveTasks for why. Default to resolving with an empty
    // listener-result array, matching "no listener threw."
    const mockEventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseInvestigatorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CaseInvestigatorService>(CaseInvestigatorService);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    cacheService = module.get(CacheService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasAccess', () => {
    it.each([['CMS_SUPERVISOR'], ['CMS_COMPLIANCE_OFFICER']])(
      'returns true immediately for %s without querying the DB',
      async (role) => {
        const result = await service.hasAccess(CASE_ID, USER_ID, TENANT, role);

        expect(result).toBe(true);
        expect(prisma.caseInvestigator.findFirst).not.toHaveBeenCalled();
      },
    );

    it('returns true for CMS_INVESTIGATOR with a live allowlist row', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 1 });

      const result = await service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toBe(true);
      expect(prisma.caseInvestigator.findFirst).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, user_id: USER_ID, tenant_id: TENANT, revoked_at: null },
        select: { id: true },
      });
    });

    it('returns false for CMS_INVESTIGATOR with no live row on a claimed case', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      prisma.case.findFirst.mockResolvedValue(null);

      const result = await service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toBe(false);
      expect(prisma.case.findFirst).toHaveBeenCalledWith({
        where: {
          case_id: CASE_ID,
          tenant_id: TENANT,
          status: { in: [CaseStatus.STATUS_00_DRAFT, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT] },
        },
        select: { case_id: true },
      });
    });

    it('returns true for CMS_INVESTIGATOR with no live row on an open-for-claim case', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);

      const result = await service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toBe(true);
    });

    it('returns false for a blocklisted CMS_INVESTIGATOR even on an open-for-claim case', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 9 });

      const result = await service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toBe(false);
    });

    it('filters by tenant_id directly, not just case_id/user_id (tenant isolation)', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.hasAccess(CASE_ID, USER_ID, 'tenant-other', 'CMS_INVESTIGATOR');

      expect(prisma.caseInvestigator.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenant_id: 'tenant-other' }) }),
      );
    });
  });

  describe('assertReadAccess', () => {
    it('resolves silently when access is allowed', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.assertReadAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBeUndefined();
    });

    it('throws NotFoundException (not Forbidden) when access is denied, matching the "don\'t leak existence" convention', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await expect(service.assertReadAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(
        new NotFoundException('Case not found or access denied'),
      );
    });
  });

  describe('getAccessibleCaseIds', () => {
    it('returns the live allowlist case_ids for this user, tenant-scoped', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ case_id: 1 }, { case_id: 5 }]);

      const result = await service.getAccessibleCaseIds(USER_ID, TENANT);

      expect(result).toEqual([1, 5]);
      expect(prisma.caseInvestigator.findMany).toHaveBeenCalledWith({
        where: { user_id: USER_ID, tenant_id: TENANT, revoked_at: null },
        select: { case_id: true },
      });
    });

    it('returns an empty array when the user has no live rows', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([]);

      const result = await service.getAccessibleCaseIds(USER_ID, TENANT);

      expect(result).toEqual([]);
    });
  });

  describe('assertCanModifyCase', () => {
    const holders = (...ids) => ids.map((id) => ({ assigned_user_id: id }));

    it.each(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'])('lets %s through without querying tasks', async (role) => {
      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, role)).resolves.toBeUndefined();

      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('is open when nobody currently holds the case, as long as the caller can see it', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      // A real live allowlist row - genuine case access, not just an unconfigured mock default.
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBeUndefined();
    });

    it('rejects a caller with no case access at all even when the case is open (no holder)', async () => {
      // Regression: "the case is open" alone used to let ANY caller through unconditionally,
      // with no read-access check at all - including someone with no legitimate access to this
      // case whatsoever (e.g. a cross-tenant caseId, or simply not a member and not in a
      // claimable status). That must now 404, same as every other gated path.
      prisma.task.findMany.mockResolvedValue([]);
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(NotFoundException);
    });

    it('lets the holder through, including when several people hold live tasks on the case', async () => {
      prisma.task.findMany.mockResolvedValue(holders('someone-else', USER_ID));
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBeUndefined();
    });

    it('rejects a blocklisted holder even though they hold a live task on the case', async () => {
      prisma.task.findMany.mockResolvedValue(holders(USER_ID));
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 9 });

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(NotFoundException);
    });

    it('only looks at live (non-completed), assigned tasks on this case in this tenant', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          case_id: CASE_ID,
          tenant_id: TENANT,
          assigned_user_id: { not: null },
          status: { not: TaskStatus.STATUS_30_COMPLETED },
        },
        select: { assigned_user_id: true },
        distinct: ['assigned_user_id'],
      });
    });

    it('gives a non-holder with no read access the same 404 as every gated read', async () => {
      prisma.task.findMany.mockResolvedValue(holders('someone-else'));
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(NotFoundException);
    });

    it('gives a non-holder who can see the case (e.g. a past OBSERVER) a 403', async () => {
      prisma.task.findMany.mockResolvedValue(holders('someone-else'));
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCaseIdScope', () => {
    it.each(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'])('returns null (unrestricted) for %s without querying the allowlist', async (role) => {
      const result = await service.getCaseIdScope(USER_ID, TENANT, role);

      expect(result).toBeNull();
      expect(prisma.caseInvestigator.findMany).not.toHaveBeenCalled();
    });

    it('returns the investigator\'s allowlist case_ids plus open-for-claim cases, deduplicated', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ case_id: 1 }, { case_id: 5 }]);
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([]);
      prisma.case.findMany.mockResolvedValue([{ case_id: 5 }, { case_id: 9 }]);

      const result = await service.getCaseIdScope(USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toEqual([1, 5, 9]);
      expect(prisma.case.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT,
          status: { in: [CaseStatus.STATUS_00_DRAFT, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT] },
        },
        select: { case_id: true },
      });
    });

    it('excludes open cases the investigator is blocklisted on', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ case_id: 1 }]);
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([{ case_id: 7 }]);
      prisma.case.findMany.mockResolvedValue([{ case_id: 9 }]);

      const result = await service.getCaseIdScope(USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toEqual([1, 9]);
      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ case_id: { notIn: [7] } }) }),
      );
    });

    it('fails closed for any other role: scoped to its own allowlist, not the whole tenant', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([]);

      const result = await service.getCaseIdScope(USER_ID, TENANT, 'alert-triage');

      expect(result).toEqual([]);
      // never browses open-for-claim cases (the only case.findMany with a status filter)
      expect(prisma.case.findMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: expect.anything() }) }));
    });
  });

  describe('isBlocklisted', () => {
    it('returns the live blocklist row when one exists', async () => {
      const row = { id: 1, blocked_by: BLOCKED_BY, block_reason: 'conflict of interest' };
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(row);

      const result = await service.isBlocklisted(CASE_ID, USER_ID, TENANT);

      expect(result).toBe(row);
      expect(prisma.caseInvestigatorBlocklist.findFirst).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, user_id: USER_ID, tenant_id: TENANT, unblocked_at: null },
      });
    });

    it('returns null when there is no live block (never blocked, or already unblocked)', async () => {
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);

      const result = await service.isBlocklisted(CASE_ID, USER_ID, TENANT);

      expect(result).toBeNull();
    });
  });

  describe('grant', () => {
    beforeEach(() => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
    });

    it('creates a new allowlist row when none exists', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.create).toHaveBeenCalledWith({
        data: { case_id: CASE_ID, tenant_id: TENANT, user_id: USER_ID, membership: CaseInvestigatorMembership.LEAD, granted_by: GRANTED_BY },
      });
    });

    it('defaults membership to OBSERVER when not specified', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY);

      expect(prisma.caseInvestigator.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ membership: CaseInvestigatorMembership.OBSERVER }) }),
      );
    });

    it('upgrades an existing OBSERVER row to LEAD in place, without creating a new row', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 7, membership: CaseInvestigatorMembership.OBSERVER });

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { membership: CaseInvestigatorMembership.LEAD },
      });
      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
    });

    it('never downgrades an existing LEAD row when granted OBSERVER (demote is the only path for that)', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 7, membership: CaseInvestigatorMembership.LEAD });

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.OBSERVER);

      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
    });

    it('is a no-op when the existing row is already LEAD and granted LEAD again', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 7, membership: CaseInvestigatorMembership.LEAD });

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });

    it('refuses with a message naming who blocked and when, and writes nothing', async () => {
      const blockedAt = new Date('2026-01-01T00:00:00Z');
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({
        blocked_by: BLOCKED_BY,
        blocked_at: blockedAt,
        block_reason: 'conflict of interest',
      });

      await expect(service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD)).rejects.toThrow(
        new ForbiddenException(
          `User is blocklisted on this case (blocked by ${BLOCKED_BY} at ${blockedAt.toISOString()}: conflict of interest) — unblock first.`,
        ),
      );
      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });

    it('refuses a cross-tenant caseId before ever checking blocklist status or writing', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(service.grant(CASE_ID, USER_ID, 'tenant-other', GRANTED_BY)).rejects.toThrow(
        new NotFoundException('Case not found or access denied'),
      );
      expect(prisma.caseInvestigatorBlocklist.findFirst).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
    });

    it('logs and rethrows on an unexpected error', async () => {
      prisma.caseInvestigator.findFirst.mockRejectedValue(new Error('DB down'));

      await expect(service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY)).rejects.toThrow('DB down');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('demote', () => {
    it('demotes an existing LEAD row to OBSERVER in place', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 9, membership: CaseInvestigatorMembership.LEAD });

      await service.demote(CASE_ID, USER_ID, TENANT);

      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { membership: CaseInvestigatorMembership.OBSERVER },
      });
    });

    it('is a no-op when the row is already OBSERVER', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 9, membership: CaseInvestigatorMembership.OBSERVER });

      await service.demote(CASE_ID, USER_ID, TENANT);

      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });

    it('is a no-op when there is no live row at all', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.demote(CASE_ID, USER_ID, TENANT);

      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });
  });

  describe('hasOtherLiveClaimOnCase', () => {
    it('returns true when another non-completed task exists', async () => {
      prisma.task.count.mockResolvedValue(1);

      const result = await service.hasOtherLiveClaimOnCase(CASE_ID, USER_ID, TENANT, 42);

      expect(result).toBe(true);
      expect(prisma.task.count).toHaveBeenCalledWith({
        where: {
          case_id: CASE_ID,
          tenant_id: TENANT,
          assigned_user_id: USER_ID,
          task_id: { not: 42 },
          status: { not: TaskStatus.STATUS_30_COMPLETED },
        },
      });
    });

    it('returns false when no other claim exists', async () => {
      prisma.task.count.mockResolvedValue(0);

      const result = await service.hasOtherLiveClaimOnCase(CASE_ID, USER_ID, TENANT, 42);

      expect(result).toBe(false);
    });
  });

  describe('syncTaskAssignment', () => {
    it('promotion: grants LEAD to the new assignee when it differs from the previous one', async () => {
      const grantSpy = jest.spyOn(service, 'grant').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: null,
        newAssigneeId: USER_ID,
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });

      expect(grantSpy).toHaveBeenCalledWith(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);
    });

    it('does not grant when the assignee is unchanged', async () => {
      const grantSpy = jest.spyOn(service, 'grant').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: USER_ID,
        newStatus: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      expect(grantSpy).not.toHaveBeenCalled();
    });

    it('reassignment: revokes the previous assignee when they hold no other live claim on the case', async () => {
      jest.spyOn(service, 'grant').mockResolvedValue(undefined);
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(false);
      // syncTaskAssignment revokes via the internal performRevoke, not the
      // guarded public revoke() - it's automated ACL bookkeeping, not the
      // deliberate supervisor action revoke()'s role-guard/task-cascade
      // apply to (see assertTargetIsInvestigator's docstring).
      const revokeSpy = jest.spyOn(service as any, 'performRevoke').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: OTHER_USER_ID,
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });

      expect(revokeSpy).toHaveBeenCalledWith(
        CASE_ID,
        USER_ID,
        TENANT,
        GRANTED_BY,
        'Automatically revoked: no longer assigned to any task on this case',
      );
    });

    it('reassignment: does NOT revoke the previous assignee when they still hold another live task on the case', async () => {
      jest.spyOn(service, 'grant').mockResolvedValue(undefined);
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(true);
      const revokeSpy = jest.spyOn(service as any, 'performRevoke').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: OTHER_USER_ID,
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });

      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('unassignment: revokes when newAssigneeId is null and no other claim remains', async () => {
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(false);
      const revokeSpy = jest.spyOn(service as any, 'performRevoke').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: null,
        newStatus: TaskStatus.STATUS_01_UNASSIGNED,
      });

      expect(revokeSpy).toHaveBeenCalledWith(CASE_ID, USER_ID, TENANT, GRANTED_BY, expect.any(String));
    });

    it('completion: demotes the assignee to OBSERVER when they hold no other live claim on the case', async () => {
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(false);
      const demoteSpy = jest.spyOn(service, 'demote').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: USER_ID,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
      });

      expect(demoteSpy).toHaveBeenCalledWith(CASE_ID, USER_ID, TENANT);
    });

    it('completion: does NOT demote when the assignee still holds another live task on the case', async () => {
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(true);
      const demoteSpy = jest.spyOn(service, 'demote').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: USER_ID,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
      });

      expect(demoteSpy).not.toHaveBeenCalled();
    });

    it('is a no-op when neither assignee changed nor completed (e.g. a plain in-progress status update)', async () => {
      const grantSpy = jest.spyOn(service, 'grant').mockResolvedValue(undefined);
      const demoteSpy = jest.spyOn(service, 'demote').mockResolvedValue(undefined);
      const revokeSpy = jest.spyOn(service, 'revoke').mockResolvedValue(undefined);

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: USER_ID,
        newStatus: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      expect(grantSpy).not.toHaveBeenCalled();
      expect(demoteSpy).not.toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('requires a non-blank reason', async () => {
      await expect(service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, '')).rejects.toThrow(BadRequestException);
      expect(prisma.caseInvestigator.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when there is no live row to revoke', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await expect(service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned')).rejects.toThrow(
        new NotFoundException('No live allowlist entry found for this user on this case'),
      );
    });

    it('soft-revokes the live row and logs to case history', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 3 });

      await service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned');

      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { revoked_at: expect.any(Date), revoked_by: GRANTED_BY, revoke_reason: 'reassigned' },
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('filters the lookup by tenant_id directly (tenant isolation)', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await expect(service.revoke(CASE_ID, USER_ID, 'tenant-other', GRANTED_BY, 'reassigned')).rejects.toThrow(NotFoundException);

      expect(prisma.caseInvestigator.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenant_id: 'tenant-other' }) }),
      );
    });

    it('supports revoke-then-re-add: a later grant() for the same user creates a fresh row rather than touching the revoked one', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce({ id: 3 }); // revoke() finds the live row
      await service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned');
      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { revoked_at: expect.any(Date), revoked_by: GRANTED_BY, revoke_reason: 'reassigned' },
      });

      // grant() re-queries for a LIVE row (revoked_at: null) — the just-revoked
      // row no longer matches, so it correctly finds none and creates a new one.
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null);
      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ user_id: USER_ID, membership: CaseInvestigatorMembership.LEAD }) }),
      );
    });

    it('refuses to revoke a supervisor target before ever touching the DB', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_SUPERVISOR');

      await expect(service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned')).rejects.toThrow(ForbiddenException);
      expect(prisma.caseInvestigator.findFirst).not.toHaveBeenCalled();
    });

    it('refuses to revoke a compliance officer target', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_COMPLIANCE_OFFICER');

      await expect(service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned')).rejects.toThrow(ForbiddenException);
    });

    it('fails closed - refuses when the target role is unknown (cache miss), rather than assuming it is safe', async () => {
      cacheService.getUserRole.mockResolvedValue(null);

      await expect(service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned')).rejects.toThrow(ForbiddenException);
      expect(prisma.caseInvestigator.findFirst).not.toHaveBeenCalled();
    });

    it("syncTaskAssignment's automatic revoke bypasses the role guard (it's ACL bookkeeping, not the deliberate action the guard is for)", async () => {
      cacheService.getUserRole.mockResolvedValue(null); // unknown role: revoke() fails closed on this, the automatic revoke must not
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(false);
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 9 });

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: null,
        newStatus: TaskStatus.STATUS_01_UNASSIGNED,
      });

      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9 } }),
      );
    });
  });

  describe('supervisors and compliance officers get no allowlist rows', () => {
    it.each(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'])('grant() does nothing for a %s', async (role) => {
      cacheService.getUserRole.mockResolvedValue(role);

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
      expect(prisma.case.findFirst).not.toHaveBeenCalled();
    });

    it('grant() still writes for an investigator', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_INVESTIGATOR');
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.create).toHaveBeenCalled();
    });

    it('grant() still writes when the cached role is unknown (a cache miss must never cost an investigator their row)', async () => {
      cacheService.getUserRole.mockResolvedValue(null);
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD);

      expect(prisma.caseInvestigator.create).toHaveBeenCalled();
    });

    it('syncTaskAssignment does not try to revoke a supervisor who is reassigned off a task (there is no row to revoke)', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_SUPERVISOR');

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 5,
        previousAssigneeId: USER_ID,
        newAssigneeId: null,
      });

      expect(prisma.task.count).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });

  });

  describe('listBlockedUserIds', () => {
    it('returns the ids of the live blocklist entries for the case, tenant-scoped, ids only', async () => {
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([{ user_id: USER_ID }, { user_id: OTHER_USER_ID }]);

      await expect(service.listBlockedUserIds(CASE_ID, TENANT)).resolves.toEqual([USER_ID, OTHER_USER_ID]);
      expect(prisma.caseInvestigatorBlocklist.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, unblocked_at: null },
        select: { user_id: true },
      });
    });

    it('returns an empty list when nobody is blocked', async () => {
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([]);

      await expect(service.listBlockedUserIds(CASE_ID, TENANT)).resolves.toEqual([]);
    });
  });

  describe('formatBlockedMessage', () => {
    const blocked = { id: 1, blocked_by: BLOCKED_BY, blocked_at: new Date('2026-01-01T00:00:00Z'), block_reason: 'conflict of interest' } as any;

    it('names the person who blocked them, not their id', async () => {
      cacheService.getUserFromCache = jest.fn().mockResolvedValue({ id: BLOCKED_BY, fullName: 'Sam Visor', username: 'sam@x.org' });

      const message = await service.formatBlockedMessage(blocked);

      expect(message).toBe('User is blocklisted on this case (blocked by Sam Visor at 2026-01-01T00:00:00.000Z: conflict of interest) — unblock first.');
      expect(message).not.toContain(BLOCKED_BY);
      expect(cacheService.getUserFromCache).toHaveBeenCalledWith(BLOCKED_BY);
    });

    it('falls back to the username when the full name is blank', async () => {
      cacheService.getUserFromCache = jest.fn().mockResolvedValue({ id: BLOCKED_BY, fullName: '   ', username: 'sam@x.org' });

      await expect(service.formatBlockedMessage(blocked)).resolves.toContain('blocked by sam@x.org at');
    });

    it('falls back to the id when the blocker is not in the user cache', async () => {
      cacheService.getUserFromCache = jest.fn().mockResolvedValue(null);

      await expect(service.formatBlockedMessage(blocked)).resolves.toContain(`blocked by ${BLOCKED_BY} at`);
    });

    it('falls back to the id, and still returns the message, when the cache lookup throws', async () => {
      cacheService.getUserFromCache = jest.fn().mockRejectedValue(new Error('redis down'));

      await expect(service.formatBlockedMessage(blocked)).resolves.toContain(`blocked by ${BLOCKED_BY} at`);
    });

    it('is the message grant() refuses a blocked user with', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_INVESTIGATOR');
      cacheService.getUserFromCache = jest.fn().mockResolvedValue({ id: BLOCKED_BY, fullName: 'Sam Visor', username: 'sam@x.org' });
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(blocked);

      await expect(service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY)).rejects.toThrow(/blocked by Sam Visor/);
    });
  });

  describe('getRestrictedCaseIds', () => {
    it('returns cases the user was revoked from and has no live row on', async () => {
      prisma.caseInvestigator.findMany
        .mockResolvedValueOnce([{ case_id: 843 }, { case_id: 843 }, { case_id: 9 }]) // revoked rows (843 twice)
        .mockResolvedValueOnce([{ case_id: 9 }]); // 9 was re-granted since
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValueOnce([]);

      await expect(service.getRestrictedCaseIds(USER_ID, TENANT)).resolves.toEqual([843]);
      expect(prisma.caseInvestigator.findMany).toHaveBeenNthCalledWith(1, {
        where: { user_id: USER_ID, tenant_id: TENANT, revoked_at: { not: null } },
        select: { case_id: true },
      });
    });

    it('leaves out cases the user is blocklisted on - a blocklist also revokes the row, but it removes the case from the queue', async () => {
      prisma.caseInvestigator.findMany
        .mockResolvedValueOnce([{ case_id: 843 }, { case_id: 9 }]) // both revoked
        .mockResolvedValueOnce([]); // neither re-granted
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValueOnce([{ case_id: 9 }]); // 9 is blocklisted

      await expect(service.getRestrictedCaseIds(USER_ID, TENANT)).resolves.toEqual([843]);
    });

    it('returns an empty list, with no second query, when nothing was revoked', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValueOnce([]);

      await expect(service.getRestrictedCaseIds(USER_ID, TENANT)).resolves.toEqual([]);
      expect(prisma.caseInvestigator.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('access levels: full / restricted / none', () => {
    // hasAccess false: no live row, case not open for claiming, not the creator.
    const noFullAccess = (): void => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null);
      prisma.case.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    };

    it('FULL with a live allowlist row', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce({ id: 1 });

      await expect(service.getAccessLevel(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe('FULL');
    });

    it.each(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'])('FULL for a %s without any lookup', async (role) => {
      await expect(service.getAccessLevel(CASE_ID, USER_ID, TENANT, role)).resolves.toBe('FULL');
      expect(prisma.caseInvestigator.findFirst).not.toHaveBeenCalled();
    });

    it('RESTRICTED when revoked (no live row) and not blocklisted', async () => {
      noFullAccess();
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce({ id: 9 }); // the revoked row

      await expect(service.getAccessLevel(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe('RESTRICTED');
    });

    it('NONE when revoked but also blocklisted - a block removes the case, a plain revoke does not', async () => {
      noFullAccess();
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 1, blocked_by: BLOCKED_BY, blocked_at: new Date(), block_reason: 'x' });

      await expect(service.getAccessLevel(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe('NONE');
    });

    it('NONE when the user was never part of the case', async () => {
      noFullAccess();
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null); // no revoked row either

      await expect(service.getAccessLevel(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe('NONE');
    });

    it('assertViewAccess returns the level for restricted users and the usual 404 for none', async () => {
      noFullAccess();
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce({ id: 9 });
      await expect(service.assertViewAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe('RESTRICTED');

      noFullAccess();
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null);
      await expect(service.assertViewAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(
        new NotFoundException('Case not found or access denied'),
      );
    });

    it('assertReadAccess (evidence, comments, reports) still refuses a restricted user - they are not allowed the investigation material', async () => {
      noFullAccess();
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);

      await expect(service.assertReadAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(NotFoundException);
    });

    it('assertCanModifyCase gives a restricted user a 403 (they can see the case, not change it)', async () => {
      prisma.task.findMany.mockResolvedValue([{ assigned_user_id: 'someone-else' }]);
      noFullAccess();
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce({ id: 9 });

      await expect(service.assertCanModifyCase(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).rejects.toThrow(ForbiddenException);
    });

    it('getCaseIdScope adds revoked cases only when asked (the history logs a revoked investigator may read)', async () => {
      prisma.caseInvestigator.findMany
        .mockResolvedValueOnce([{ case_id: 1 }]) // live allowlist
        .mockResolvedValueOnce([{ case_id: 843 }]) // revoked
        .mockResolvedValueOnce([]); // none re-granted
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([]);
      prisma.case.findMany.mockResolvedValue([]);

      await expect(service.getCaseIdScope(USER_ID, TENANT, 'CMS_INVESTIGATOR', true)).resolves.toEqual([1, 843]);
    });
  });

  describe('creator access (cases pending creation approval)', () => {
    it('lets the creator open their own case when they hold no task, row or open-for-claim status', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null); // no live allowlist row
      prisma.case.findFirst
        .mockResolvedValueOnce(null) // not open for claiming
        .mockResolvedValueOnce({ case_id: CASE_ID }); // but created by this user
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null); // no revoked row

      await expect(service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe(true);
      expect(prisma.case.findFirst).toHaveBeenLastCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, case_creator_user_id: USER_ID },
        select: { case_id: true },
      });
    });

    it('does not extend access to someone who did not create the case', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null);
      prisma.case.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe(false);
    });

    it('denies the creator once they are blocklisted on the case', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null);
      prisma.case.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 1, blocked_by: BLOCKED_BY, blocked_at: new Date(), block_reason: 'x' });

      await expect(service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe(false);
    });

    it('denies the creator once a supervisor has revoked them from the case', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 9 }); // no live row, but a revoked one
      prisma.case.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ case_id: CASE_ID });
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);

      await expect(service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR')).resolves.toBe(false);
    });

    it('getAccessibleCaseIds adds created cases to the allowlist ids, minus blocklisted and revoked ones', async () => {
      prisma.caseInvestigator.findMany
        .mockResolvedValueOnce([{ case_id: 1 }]) // live allowlist
        .mockResolvedValueOnce([{ case_id: 4 }]); // revoked among the created ones
      prisma.case.findMany.mockResolvedValueOnce([{ case_id: 1 }, { case_id: 2 }, { case_id: 3 }, { case_id: 4 }]); // created
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValueOnce([{ case_id: 3 }]); // blocklisted among the created ones

      await expect(service.getAccessibleCaseIds(USER_ID, TENANT)).resolves.toEqual([1, 2]);
    });
  });

  describe('live dashboard refresh: case.access-changed', () => {
    it('emits case.access-changed after a blocklist, so the investigator queue refreshes', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');

      expect(eventEmitter.emit).toHaveBeenCalledWith('case.access-changed', { caseId: CASE_ID, tenantId: TENANT });
    });

    it('emits it after the task-unassign cascade finishes, so a refetch sees the final state', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });
      const order: string[] = [];
      eventEmitter.emitAsync.mockImplementationOnce(async () => {
        order.push('cascade');
        return [];
      });
      eventEmitter.emit.mockImplementationOnce(() => {
        order.push('notify');
      });

      await service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict');

      expect(order).toEqual(['cascade', 'notify']);
    });

    it('emits case.access-changed after a revoke', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 3 });

      await service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned');

      expect(eventEmitter.emit).toHaveBeenCalledWith('case.access-changed', { caseId: CASE_ID, tenantId: TENANT });
    });

    it('emits case.access-changed after an unblock, so the case reappears in the queue', async () => {
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 6 });

      await service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved');

      expect(eventEmitter.emit).toHaveBeenCalledWith('case.access-changed', { caseId: CASE_ID, tenantId: TENANT });
    });

    it('does not emit when the blocklist is refused (nothing changed)', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_SUPERVISOR');

      await expect(service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict')).rejects.toThrow();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('never fails the access change if the emit itself throws', async () => {
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 6 });
      eventEmitter.emit.mockImplementationOnce(() => {
        throw new Error('listener blew up');
      });

      await expect(service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved')).resolves.toBeUndefined();
    });
  });

  describe('revoke / blocklist: task-unassign cascade', () => {
    // CaseInvestigatorService does not call the task repository or
    // TaskLifecycleService directly for this cascade - it emits
    // 'case-investigator.access-removed' (via emitAsync, awaited) and
    // TaskLifecycleService.handleAccessRemoved (a separate @OnEvent
    // listener, covered by its own tests in task-lifecycle.service.spec.ts)
    // does the actual task lookup/unassignment. Direct injection was
    // rejected - see the module-level comment on unassignLiveTasks for why.
    it('emits case-investigator.access-removed with the revoke details when revoked', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 3 });

      await service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned');

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('case-investigator.access-removed', {
        caseId: CASE_ID,
        userId: USER_ID,
        tenantId: TENANT,
        actorUserId: GRANTED_BY,
        reason: expect.stringContaining('reassigned'),
      });
    });

    it('emits case-investigator.access-removed when blocklisted too', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });

      await service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('case-investigator.access-removed', {
        caseId: CASE_ID,
        userId: USER_ID,
        tenantId: TENANT,
        actorUserId: BLOCKED_BY,
        reason: expect.stringContaining('conflict of interest'),
      });
    });

    it('a listener failure is caught and logged but does not fail the revoke itself', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 3 });
      eventEmitter.emitAsync.mockRejectedValueOnce(new Error('flowable unavailable'));

      await expect(service.revoke(CASE_ID, USER_ID, TENANT, GRANTED_BY, 'reassigned')).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('a listener failure is caught and logged but does not fail the blocklist itself', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });
      eventEmitter.emitAsync.mockRejectedValueOnce(new Error('flowable unavailable'));

      await expect(service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest')).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('blocklist', () => {
    it('requires a non-blank reason', async () => {
      await expect(service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, '')).rejects.toThrow(BadRequestException);
      expect(prisma.case.findFirst).not.toHaveBeenCalled();
    });

    it('refuses to blocklist a supervisor or compliance officer target before ever touching the DB', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_SUPERVISOR');

      await expect(service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict')).rejects.toThrow(ForbiddenException);
      expect(prisma.case.findFirst).not.toHaveBeenCalled();
    });

    it('refuses a cross-tenant caseId before writing anything', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(service.blocklist(CASE_ID, USER_ID, 'tenant-other', BLOCKED_BY, 'conflict')).rejects.toThrow(
        new NotFoundException('Case not found or access denied'),
      );
      expect(prisma.caseInvestigatorBlocklist.create).not.toHaveBeenCalled();
    });

    it('revokes any live allowlist row (reason "blocklisted") and creates the blocklist row, in one transaction', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });

      await service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');

      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { revoked_at: expect.any(Date), revoked_by: BLOCKED_BY, revoke_reason: 'blocklisted' },
      });
      expect(prisma.caseInvestigatorBlocklist.create).toHaveBeenCalledWith({
        data: { case_id: CASE_ID, tenant_id: TENANT, user_id: USER_ID, blocked_by: BLOCKED_BY, block_reason: 'conflict of interest' },
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('creates the blocklist row even when there was no live allowlist row to revoke', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'preemptive block');

      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
      expect(prisma.caseInvestigatorBlocklist.create).toHaveBeenCalled();
    });

    it('maps a P2002 from the live-blocklist unique index to a 409 and skips logging and task unassignment', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      prisma.caseInvestigatorBlocklist.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'dup')).rejects.toThrow(ConflictException);
      expect(loggingOrchestrationService.logActionsWithHistory).not.toHaveBeenCalled();
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('rethrows non-P2002 errors from the blocklist transaction unchanged', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      const boom = new Error('db down');
      prisma.caseInvestigatorBlocklist.create.mockRejectedValue(boom);

      await expect(service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'x')).rejects.toBe(boom);
    });

    it('blocklist-then-refuse-grant: a live block causes a later grant() to be refused', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      await service.blocklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');
      expect(prisma.caseInvestigatorBlocklist.create).toHaveBeenCalled();

      // Simulate the write actually landing, then a task assignment trying to grant this user access.
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({
        blocked_by: BLOCKED_BY,
        blocked_at: new Date(),
        block_reason: 'conflict of interest',
      });

      await expect(service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
    });
  });

  describe('unblock', () => {
    it('requires a non-blank reason', async () => {
      await expect(service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, '')).rejects.toThrow(BadRequestException);
      expect(prisma.caseInvestigatorBlocklist.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when there is no live block to unblock', async () => {
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue(null);

      await expect(service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved')).rejects.toThrow(
        new NotFoundException('No live blocklist entry found for this user on this case'),
      );
    });

    it('soft-unblocks the live row and logs to case history', async () => {
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 6 });

      await service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved');

      expect(prisma.caseInvestigatorBlocklist.update).toHaveBeenCalledWith({
        where: { id: 6 },
        data: { unblocked_at: expect.any(Date), unblocked_by: BLOCKED_BY, unblock_reason: 'resolved' },
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('does NOT grant access back — an unblocked user still has no live allowlist row until a fresh task assignment', async () => {
      prisma.caseInvestigatorBlocklist.findFirst.mockResolvedValue({ id: 6 });

      await service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved');

      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });
  });

  describe('listAccessHistory', () => {
    it('returns revoked allowlist rows and unblocked blocklist rows, tenant-scoped and most recent first', async () => {
      const revoked = [{ id: 7, user_id: USER_ID, revoked_at: new Date('2026-10-21'), revoke_reason: 'fsafasde' }];
      const unblocked = [{ id: 2, user_id: OTHER_USER_ID, unblocked_at: new Date('2026-10-20'), unblock_reason: 'cleared' }];
      prisma.caseInvestigator.findMany.mockResolvedValue(revoked);
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue(unblocked);

      const result = await service.listAccessHistory(CASE_ID, TENANT);

      expect(result).toEqual({ revoked: [{ ...revoked[0], user_role: 'CMS_INVESTIGATOR' }], unblocked });
      expect(prisma.caseInvestigator.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, revoked_at: { not: null } },
        orderBy: { revoked_at: 'desc' },
      });
      expect(prisma.caseInvestigatorBlocklist.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, unblocked_at: { not: null } },
        orderBy: { unblocked_at: 'desc' },
      });
    });

    it('does not filter by reason, so automatic revokes (reassigned away) are part of the history too', async () => {
      const auto = { id: 8, user_id: USER_ID, revoked_at: new Date(), revoke_reason: 'Automatically revoked: no longer assigned to any task on this case' };
      prisma.caseInvestigator.findMany.mockResolvedValue([auto]);
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([]);

      const result = await service.listAccessHistory(CASE_ID, TENANT);

      expect(result.revoked.map((row) => row.id)).toEqual([8]);
    });

    it('returns empty lists when nobody was ever revoked or unblocked', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([]);
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([]);

      await expect(service.listAccessHistory(CASE_ID, TENANT)).resolves.toEqual({ revoked: [], unblocked: [] });
    });

    it('reports role null (unknown), not a guess, when the role lookup fails - and still returns the rows', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ id: 7, user_id: USER_ID }]);
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue([]);
      cacheService.getUserRole.mockRejectedValue(new Error('redis down'));

      const result = await service.listAccessHistory(CASE_ID, TENANT);

      expect(result.revoked).toEqual([{ id: 7, user_id: USER_ID, user_role: null }]);
    });
  });

  describe('listAllowlist / listBlocklist', () => {
    it('listAllowlist filters live rows by case_id and tenant_id, ordered by granted_at asc', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ id: 1, user_id: USER_ID }]);

      const result = await service.listAllowlist(CASE_ID, TENANT);

      expect(result).toEqual([{ id: 1, user_id: USER_ID, user_role: 'CMS_INVESTIGATOR' }]);
      expect(prisma.caseInvestigator.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, revoked_at: null },
        orderBy: { granted_at: 'asc' },
      });
    });

    it('listAllowlist tags each row with its user role, and keeps rows that already exist for supervisors/compliance officers', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([
        { id: 1, user_id: USER_ID },
        { id: 2, user_id: OTHER_USER_ID },
        { id: 3, user_id: GRANTED_BY },
      ]);
      cacheService.getUserRole.mockImplementation(async (id: string) =>
        ({ [USER_ID]: 'CMS_INVESTIGATOR', [OTHER_USER_ID]: 'CMS_SUPERVISOR', [GRANTED_BY]: 'CMS_COMPLIANCE_OFFICER' })[id] ?? null,
      );

      const result = await service.listAllowlist(CASE_ID, TENANT);

      expect(result.map((r: any) => r.user_role)).toEqual(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER']);
    });

    it('listAllowlist looks each distinct user up once', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([
        { id: 1, user_id: USER_ID },
        { id: 2, user_id: USER_ID },
      ]);

      await service.listAllowlist(CASE_ID, TENANT);

      expect(cacheService.getUserRole).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a cache miss', async () => null],
      ['a cache failure', async () => {
        throw new Error('redis down');
      }],
    ])('listAllowlist reports role null (unknown), not a guess, on %s - and still returns the rows', async (_desc, impl) => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ id: 1, user_id: USER_ID }]);
      cacheService.getUserRole.mockImplementation(impl);

      const result = await service.listAllowlist(CASE_ID, TENANT);

      expect(result).toEqual([{ id: 1, user_id: USER_ID, user_role: null }]);
    });

    it('listBlocklist filters live rows by case_id and tenant_id, ordered by blocked_at asc', async () => {
      const rows = [{ id: 2 }];
      prisma.caseInvestigatorBlocklist.findMany.mockResolvedValue(rows);

      const result = await service.listBlocklist(CASE_ID, TENANT);

      expect(result).toBe(rows);
      expect(prisma.caseInvestigatorBlocklist.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, unblocked_at: null },
        orderBy: { blocked_at: 'asc' },
      });
    });
  });
});
