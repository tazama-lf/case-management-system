import { CanActivate, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CaseInvestigatorController } from '../src/modules/case-investigator/case-investigator.controller';
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
 * GET /cases/:caseId/blocked-users feeds the assign / reassign dropdowns. It is open to anyone who may
 * view the case (not just supervisors), returns ids only, and is refused with the usual 404 otherwise.
 */
describe('CaseInvestigatorController - blocked users for the assign dropdowns', () => {
  let controller: CaseInvestigatorController;
  let acl: { assertViewAccess: jest.Mock; listBlockedUserIds: jest.Mock };

  beforeEach(async () => {
    acl = {
      assertViewAccess: jest.fn().mockResolvedValue('FULL'),
      listBlockedUserIds: jest.fn().mockResolvedValue(['blocked-1', 'blocked-2']),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseInvestigatorController],
      providers: [
        { provide: CaseInvestigatorService, useValue: acl },
        { provide: 'AUDIT_LOGGER', useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideGuard(TazamaAuthGuard)
      .useClass(AllowAllGuard)
      .compile();

    controller = module.get(CaseInvestigatorController);
  });

  it('returns the blocked user ids, and nothing else about the blocks, for someone who may view the case', async () => {
    const result = await controller.getBlockedUsers(CASE_ID, req);

    expect(acl.assertViewAccess).toHaveBeenCalledWith(CASE_ID, USER_ID, TENANT, ROLE);
    expect(acl.listBlockedUserIds).toHaveBeenCalledWith(CASE_ID, TENANT);
    expect(result).toEqual({ userIds: ['blocked-1', 'blocked-2'] });
  });

  it('also serves a restricted (revoked) viewer, who can still assign nothing but may open the modal', async () => {
    acl.assertViewAccess.mockResolvedValueOnce('RESTRICTED');

    await expect(controller.getBlockedUsers(CASE_ID, req)).resolves.toEqual({ userIds: ['blocked-1', 'blocked-2'] });
  });

  it('refuses someone with no access to the case before reading anything', async () => {
    const denied = new NotFoundException('Case not found or access denied');
    acl.assertViewAccess.mockRejectedValueOnce(denied);

    await expect(controller.getBlockedUsers(CASE_ID, req)).rejects.toBe(denied);
    expect(acl.listBlockedUserIds).not.toHaveBeenCalled();
  });
});
