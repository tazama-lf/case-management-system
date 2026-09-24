import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseInvestigatorService } from '../src/modules/case-investigator/case-investigator.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { CacheService } from '../src/modules/shared/cache.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CaseInvestigatorMembership, TaskStatus } from '@prisma/client-cms';

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
      caseInvestigatorBlacklist: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      case: {
        findFirst: jest.fn(),
      },
      task: {
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    // blacklist() runs its work inside `this.prismaService.$transaction(async (tx) => ...)`
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

    // revoke/blacklist only reach the DB once the target's cached role
    // passes assertTargetIsInvestigator - default to a live investigator
    // target so every existing revoke/blacklist test still exercises the
    // same behavior it did before that guard existed. Role-guard behavior
    // itself is covered by its own dedicated tests below.
    const mockCacheService = {
      getUserRole: jest.fn().mockResolvedValue('CMS_INVESTIGATOR'),
    };

    // revoke/blacklist emit 'case-investigator.access-removed' (via emitAsync)
    // rather than calling TaskLifecycleService directly - see the docstring
    // on unassignLiveTasks for why. Default to resolving with an empty
    // listener-result array, matching "no listener threw."
    const mockEventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
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

    it('returns true for CMS_INVESTIGATOR with a live whitelist row', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 1 });

      const result = await service.hasAccess(CASE_ID, USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toBe(true);
      expect(prisma.caseInvestigator.findFirst).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, user_id: USER_ID, tenant_id: TENANT, revoked_at: null },
        select: { id: true },
      });
    });

    it('returns false for CMS_INVESTIGATOR with no live row', async () => {
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

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
    it('returns the live whitelist case_ids for this user, tenant-scoped', async () => {
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

  describe('getCaseIdScope', () => {
    it.each(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'])('returns null (unrestricted) for %s without querying the whitelist', async (role) => {
      const result = await service.getCaseIdScope(USER_ID, TENANT, role);

      expect(result).toBeNull();
      expect(prisma.caseInvestigator.findMany).not.toHaveBeenCalled();
    });

    it('returns the investigator\'s live whitelist case_ids', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([{ case_id: 1 }, { case_id: 5 }]);

      const result = await service.getCaseIdScope(USER_ID, TENANT, 'CMS_INVESTIGATOR');

      expect(result).toEqual([1, 5]);
    });

    it('fails closed for any other role: scoped to its own whitelist, not the whole tenant', async () => {
      prisma.caseInvestigator.findMany.mockResolvedValue([]);

      const result = await service.getCaseIdScope(USER_ID, TENANT, 'alert-triage');

      expect(result).toEqual([]);
    });
  });

  describe('isBlacklisted', () => {
    it('returns the live blacklist row when one exists', async () => {
      const row = { id: 1, blocked_by: BLOCKED_BY, block_reason: 'conflict of interest' };
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue(row);

      const result = await service.isBlacklisted(CASE_ID, USER_ID, TENANT);

      expect(result).toBe(row);
      expect(prisma.caseInvestigatorBlacklist.findFirst).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, user_id: USER_ID, tenant_id: TENANT, unblocked_at: null },
      });
    });

    it('returns null when there is no live block (never blocked, or already unblocked)', async () => {
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue(null);

      const result = await service.isBlacklisted(CASE_ID, USER_ID, TENANT);

      expect(result).toBeNull();
    });
  });

  describe('grant', () => {
    beforeEach(() => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue(null);
    });

    it('creates a new whitelist row when none exists', async () => {
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
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue({
        blocked_by: BLOCKED_BY,
        blocked_at: blockedAt,
        block_reason: 'conflict of interest',
      });

      await expect(service.grant(CASE_ID, USER_ID, TENANT, GRANTED_BY, CaseInvestigatorMembership.LEAD)).rejects.toThrow(
        new ForbiddenException(
          `User is blacklisted on this case (blocked by ${BLOCKED_BY} at ${blockedAt.toISOString()}: conflict of interest) — unblock first.`,
        ),
      );
      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });

    it('refuses a cross-tenant caseId before ever checking blacklist status or writing', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(service.grant(CASE_ID, USER_ID, 'tenant-other', GRANTED_BY)).rejects.toThrow(
        new NotFoundException('Case not found or access denied'),
      );
      expect(prisma.caseInvestigatorBlacklist.findFirst).not.toHaveBeenCalled();
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
        new NotFoundException('No live whitelist entry found for this user on this case'),
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
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue(null);
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

    it("syncTaskAssignment's automatic revoke bypasses the role guard entirely (it's ACL bookkeeping, not the deliberate action the guard is for)", async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_SUPERVISOR'); // would be refused by revoke()
      jest.spyOn(service, 'hasOtherLiveClaimOnCase').mockResolvedValue(false);
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 9 });

      await service.syncTaskAssignment(CASE_ID, TENANT, GRANTED_BY, {
        taskId: 1,
        previousAssigneeId: USER_ID,
        newAssigneeId: null,
        newStatus: TaskStatus.STATUS_01_UNASSIGNED,
      });

      expect(cacheService.getUserRole).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9 } }),
      );
    });
  });

  describe('revoke / blacklist: task-unassign cascade', () => {
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

    it('emits case-investigator.access-removed when blacklisted too', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });

      await service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');

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

    it('a listener failure is caught and logged but does not fail the blacklist itself', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });
      eventEmitter.emitAsync.mockRejectedValueOnce(new Error('flowable unavailable'));

      await expect(service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest')).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('blacklist', () => {
    it('requires a non-blank reason', async () => {
      await expect(service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, '')).rejects.toThrow(BadRequestException);
      expect(prisma.case.findFirst).not.toHaveBeenCalled();
    });

    it('refuses to blacklist a supervisor or compliance officer target before ever touching the DB', async () => {
      cacheService.getUserRole.mockResolvedValue('CMS_SUPERVISOR');

      await expect(service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict')).rejects.toThrow(ForbiddenException);
      expect(prisma.case.findFirst).not.toHaveBeenCalled();
    });

    it('refuses a cross-tenant caseId before writing anything', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(service.blacklist(CASE_ID, USER_ID, 'tenant-other', BLOCKED_BY, 'conflict')).rejects.toThrow(
        new NotFoundException('Case not found or access denied'),
      );
      expect(prisma.caseInvestigatorBlacklist.create).not.toHaveBeenCalled();
    });

    it('revokes any live whitelist row (reason "blacklisted") and creates the blacklist row, in one transaction', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue({ id: 5 });

      await service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');

      expect(prisma.caseInvestigator.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { revoked_at: expect.any(Date), revoked_by: BLOCKED_BY, revoke_reason: 'blacklisted' },
      });
      expect(prisma.caseInvestigatorBlacklist.create).toHaveBeenCalledWith({
        data: { case_id: CASE_ID, tenant_id: TENANT, user_id: USER_ID, blocked_by: BLOCKED_BY, block_reason: 'conflict of interest' },
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('creates the blacklist row even when there was no live whitelist row to revoke', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);

      await service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'preemptive block');

      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
      expect(prisma.caseInvestigatorBlacklist.create).toHaveBeenCalled();
    });

    it('blacklist-then-refuse-grant: a live block causes a later grant() to be refused', async () => {
      prisma.case.findFirst.mockResolvedValue({ case_id: CASE_ID });
      prisma.caseInvestigator.findFirst.mockResolvedValue(null);
      await service.blacklist(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'conflict of interest');
      expect(prisma.caseInvestigatorBlacklist.create).toHaveBeenCalled();

      // Simulate the write actually landing, then a task assignment trying to grant this user access.
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue({
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
      expect(prisma.caseInvestigatorBlacklist.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when there is no live block to unblock', async () => {
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue(null);

      await expect(service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved')).rejects.toThrow(
        new NotFoundException('No live blacklist entry found for this user on this case'),
      );
    });

    it('soft-unblocks the live row and logs to case history', async () => {
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue({ id: 6 });

      await service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved');

      expect(prisma.caseInvestigatorBlacklist.update).toHaveBeenCalledWith({
        where: { id: 6 },
        data: { unblocked_at: expect.any(Date), unblocked_by: BLOCKED_BY, unblock_reason: 'resolved' },
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('does NOT grant access back — an unblocked user still has no live whitelist row until a fresh task assignment', async () => {
      prisma.caseInvestigatorBlacklist.findFirst.mockResolvedValue({ id: 6 });

      await service.unblock(CASE_ID, USER_ID, TENANT, BLOCKED_BY, 'resolved');

      expect(prisma.caseInvestigator.create).not.toHaveBeenCalled();
      expect(prisma.caseInvestigator.update).not.toHaveBeenCalled();
    });
  });

  describe('listWhitelist / listBlacklist', () => {
    it('listWhitelist filters live rows by case_id and tenant_id, ordered by granted_at asc', async () => {
      const rows = [{ id: 1 }];
      prisma.caseInvestigator.findMany.mockResolvedValue(rows);

      const result = await service.listWhitelist(CASE_ID, TENANT);

      expect(result).toBe(rows);
      expect(prisma.caseInvestigator.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, revoked_at: null },
        orderBy: { granted_at: 'asc' },
      });
    });

    it('listBlacklist filters live rows by case_id and tenant_id, ordered by blocked_at asc', async () => {
      const rows = [{ id: 2 }];
      prisma.caseInvestigatorBlacklist.findMany.mockResolvedValue(rows);

      const result = await service.listBlacklist(CASE_ID, TENANT);

      expect(result).toBe(rows);
      expect(prisma.caseInvestigatorBlacklist.findMany).toHaveBeenCalledWith({
        where: { case_id: CASE_ID, tenant_id: TENANT, unblocked_at: null },
        orderBy: { blocked_at: 'asc' },
      });
    });
  });
});
