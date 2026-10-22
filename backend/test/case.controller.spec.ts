import { CanActivate, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CaseController } from '../src/modules/case/case.controller';
import { CaseService } from '../src/modules/case/case.service';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { CasePriorityService } from '../src/modules/alert-priority/case-priority.service';
import { CasePriorityUtil } from '../src/modules/shared/utils/case-priority.util';
import { CaseInvestigatorService } from '../src/modules/case-investigator/case-investigator.service';
import { TazamaAuthGuard } from '../src/guards/tazama-auth.guard';

class AllowAllGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

const CASE_ID = 42;
const USER_ID = 'user-1';
const TENANT = 'tenant-1';
const ROLE = 'CMS_INVESTIGATOR';

const req = {
  headers: { authorization: 'Bearer test-token' },
  user: {
    actorRole: ROLE,
    tenantName: 'Test Tenant',
    token: { clientId: USER_ID, tenantId: TENANT, claims: [ROLE], email: 'i@example.test', fullName: 'Test Investigator' },
  },
} as any;

/**
 * The write-side case gate lives in the controller (these service methods have internal callers),
 * so what matters here is: each endpoint calls assertCanModifyCase BEFORE the write path, and a
 * rejection stops it cold. Suspend/resume/close keep their own owner/assignee checks; reopen is
 * deliberately open to any investigator; approve/reject are supervisor-only.
 */
describe('CaseController - write ACL gate', () => {
  let controller: CaseController;
  let caseService: { abandonCase: jest.Mock; completeCase: jest.Mock; updateCase: jest.Mock; reopenCase: jest.Mock };
  let acl: { assertCanModifyCase: jest.Mock };

  beforeEach(async () => {
    caseService = {
      abandonCase: jest.fn().mockResolvedValue({ success: true }),
      completeCase: jest.fn().mockResolvedValue({ success: true }),
      updateCase: jest.fn().mockResolvedValue({ case_id: CASE_ID }),
      reopenCase: jest.fn().mockResolvedValue({ success: true }),
    };
    acl = { assertCanModifyCase: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseController],
      providers: [
        { provide: CaseService, useValue: caseService },
        { provide: CaseCreationService, useValue: {} },
        { provide: CasePriorityService, useValue: {} },
        { provide: CasePriorityUtil, useValue: {} },
        { provide: CaseInvestigatorService, useValue: acl },
        { provide: 'AUDIT_LOGGER', useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useClass(AllowAllGuard)
      .compile();

    controller = module.get(CaseController);
  });

  const cases: Array<{ name: string; call: () => Promise<unknown>; write: () => jest.Mock }> = [
    {
      name: 'PUT /:caseId (updateCase)',
      call: async () => await controller.updateCase(CASE_ID, { priority: 'HIGH' } as any, req),
      write: () => caseService.updateCase,
    },
    {
      name: 'PUT /:caseId/abandon',
      call: async () => await controller.abandonCase(CASE_ID, { reason: 'duplicate draft' } as any, req),
      write: () => caseService.abandonCase,
    },
    {
      name: 'PUT /:caseId/complete',
      call: async () => await controller.completeCase(CASE_ID, req),
      write: () => caseService.completeCase,
    },
  ];

  it.each(cases)('$name: runs the gate with the caller/role, then performs the write', async ({ call, write }) => {
    await call();

    expect(acl.assertCanModifyCase).toHaveBeenCalledWith(CASE_ID, USER_ID, TENANT, ROLE);
    expect(write()).toHaveBeenCalledTimes(1);
    expect(acl.assertCanModifyCase.mock.invocationCallOrder[0]).toBeLessThan(write().mock.invocationCallOrder[0]);
  });

  it.each(cases)('$name: a gate rejection propagates and nothing is written', async ({ call, write }) => {
    const denied = new ForbiddenException('held by another investigator');
    acl.assertCanModifyCase.mockRejectedValueOnce(denied);

    await expect(call()).rejects.toBe(denied);

    expect(write()).not.toHaveBeenCalled();
  });

  it('a non-member gets the 404 through unchanged (not swallowed or converted)', async () => {
    const notFound = new NotFoundException('Case not found or access denied');
    acl.assertCanModifyCase.mockRejectedValueOnce(notFound);

    await expect(controller.updateCase(CASE_ID, {} as any, req)).rejects.toBe(notFound);
    expect(caseService.updateCase).not.toHaveBeenCalled();
  });

  it('PUT /:caseId/reopen is deliberately NOT gated (any investigator may file a reopen request)', async () => {
    await controller.reopenCase(CASE_ID, { reason: 'new evidence surfaced' } as any, req);

    expect(acl.assertCanModifyCase).not.toHaveBeenCalled();
    expect(caseService.reopenCase).toHaveBeenCalledTimes(1);
  });
});

/**
 * Reading a case: an investigator who was revoked (RESTRICTED) still gets the case, but with the
 * investigation material withheld and access_level stamped on it; a user with no access gets the
 * gate's 404 and the case is never fetched.
 */
describe('CaseController - restricted read view (GET /:caseId)', () => {
  let controller: CaseController;
  let caseService: { retrieveCase: jest.Mock };
  let acl: { assertViewAccess: jest.Mock };

  const caseData = {
    case_id: CASE_ID,
    status: 'STATUS_22_PENDING_FINAL_APPROVAL',
    alert: { alert_id: 1, message: 'm', transaction: { FIToFIPmtSts: {} }, alert_data: { a: 1 }, network_map: { b: 2 } },
    tasks: [
      { task_id: 1, name: 'Investigate Case', investigationNotes: 'secret findings' },
      { task_id: 2, name: 'Complete New Case', investigationNotes: 'triage note' },
    ],
  };

  beforeEach(async () => {
    caseService = { retrieveCase: jest.fn().mockResolvedValue(caseData) };
    acl = { assertViewAccess: jest.fn().mockResolvedValue('FULL') };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseController],
      providers: [
        { provide: CaseService, useValue: caseService },
        { provide: CaseCreationService, useValue: {} },
        { provide: CasePriorityService, useValue: {} },
        { provide: CasePriorityUtil, useValue: {} },
        { provide: CaseInvestigatorService, useValue: acl },
        { provide: 'AUDIT_LOGGER', useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useClass(AllowAllGuard)
      .compile();

    controller = module.get(CaseController);
  });

  it('returns the case untouched, with no access_level, to a user with full access', async () => {
    const result = await controller.getCase(CASE_ID, req);

    expect(acl.assertViewAccess).toHaveBeenCalledWith(CASE_ID, USER_ID, TENANT, ROLE);
    expect(result).toBe(caseData);
    expect(result).not.toHaveProperty('access_level');
  });

  it('withholds the visualization data and the Investigate notes from a restricted user, and flags the payload', async () => {
    acl.assertViewAccess.mockResolvedValueOnce('RESTRICTED');

    const result = (await controller.getCase(CASE_ID, req)) as any;

    expect(result.access_level).toBe('RESTRICTED');
    expect(result.alert).toEqual({ alert_id: 1, message: 'm', transaction: null, alert_data: null, network_map: null });
    expect(result.tasks[0].investigationNotes).toBeNull();
    expect(result.tasks[1].investigationNotes).toBe('triage note');
    expect(result.status).toBe('STATUS_22_PENDING_FINAL_APPROVAL');
  });

  it('does not mutate the stored case when redacting', async () => {
    acl.assertViewAccess.mockResolvedValueOnce('RESTRICTED');

    await controller.getCase(CASE_ID, req);

    expect(caseData.tasks[0].investigationNotes).toBe('secret findings');
    expect(caseData.alert.transaction).toEqual({ FIToFIPmtSts: {} });
  });

  it('stops at the gate for a user with no access: the case is never fetched', async () => {
    const denied = new NotFoundException('Case not found or access denied');
    acl.assertViewAccess.mockRejectedValueOnce(denied);

    await expect(controller.getCase(CASE_ID, req)).rejects.toBe(denied);
    expect(caseService.retrieveCase).not.toHaveBeenCalled();
  });

  it('passes a missing case straight through, restricted or not', async () => {
    acl.assertViewAccess.mockResolvedValueOnce('RESTRICTED');
    caseService.retrieveCase.mockResolvedValueOnce(null);

    await expect(controller.getCase(CASE_ID, req)).resolves.toBeNull();
  });
});
