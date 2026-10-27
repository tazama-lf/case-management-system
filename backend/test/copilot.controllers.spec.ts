import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CaseReadAccessGuard } from '../src/modules/copilot/case-read-access.guard';
import { InvestigationController } from '../src/modules/copilot/investigation.controller';
import { SarController } from '../src/modules/copilot/sar.controller';
import { ReviewRefused } from '../src/modules/copilot/sar.service';

const req = (over: Record<string, unknown> = {}, tenantId = 'TAZAMA'): any => ({
  params: { caseId: '5' },
  user: { token: { clientId: 'u1', tenantId }, actorRole: 'CMS_INVESTIGATOR', actorName: 'Ayesha', actorEmail: 'a@x.org', validClaims: ['CMS_INVESTIGATOR'], ...over },
});
const caller = { userId: 'u1', tenantId: 'TAZAMA', name: 'Ayesha', email: 'a@x.org' };

describe('CaseReadAccessGuard', () => {
  const access = { assertReadAccess: jest.fn(async () => undefined) };
  const guard = new CaseReadAccessGuard(access as any);
  const context = (r: any): any => ({ switchToHttp: () => ({ getRequest: () => r }) });

  it('checks the case ACL with the case, caller, tenant and role', async () => {
    expect(await guard.canActivate(context(req()))).toBe(true);
    expect(access.assertReadAccess).toHaveBeenCalledWith(5, 'u1', 'TAZAMA', 'CMS_INVESTIGATOR');
  });

  it('refuses when the ACL does, and when the token has no tenant', async () => {
    access.assertReadAccess.mockRejectedValueOnce(new NotFoundException('Case not found or access denied'));
    await expect(guard.canActivate(context(req()))).rejects.toBeInstanceOf(NotFoundException);
    await expect(guard.canActivate(context(req({}, '')))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvestigationController', () => {
  const service = {
    latest: jest.fn(async () => null),
    investigate: jest.fn(async () => ({ id: 1 })),
    ask: jest.fn(async () => ({ recordId: 1 })),
  };
  const controller = new InvestigationController(service as any);

  it('passes the caller and tenant from the token', async () => {
    await controller.investigate(5, req());
    expect(service.investigate).toHaveBeenCalledWith(5, caller);
    await controller.latest(5, req());
    expect(service.latest).toHaveBeenCalledWith(5, 'TAZAMA');
  });

  it('trims and caps questions and rejects empty ones', async () => {
    await controller.ask(5, { question: `  ${'x'.repeat(600)} ` }, req());
    expect((service.ask.mock.calls[0] as any[])[2]).toHaveLength(500);
    await expect(controller.ask(5, { question: '  ' }, req())).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.ask(5, {}, req())).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SarController', () => {
  const state = { draftId: 3, status: 'IN_REVIEW', events: [], allowed: [] };
  const service = {
    latest: jest.fn(async () => null),
    draft: jest.fn(async () => ({ id: 2 })),
    reviewState: jest.fn(async () => state),
    review: jest.fn(async () => state),
  };
  const controller = new SarController(service as any);

  it('drafts for the caller, with refresh only when it is exactly true', async () => {
    await controller.draft(5, { refresh: true }, req());
    expect(service.draft).toHaveBeenCalledWith(5, caller, true);
    await controller.draft(5, {}, req());
    expect(service.draft).toHaveBeenLastCalledWith(5, caller, false);
  });

  it('treats a supervisor as the checker and everyone else as the maker', async () => {
    expect(await controller.review(5, req({ validClaims: ['CMS_SUPERVISOR'] }))).toMatchObject({ yourRole: 'checker' });
    expect(await controller.review(5, req({ validClaims: ['CMS_COMPLIANCE_OFFICER'] }))).toMatchObject({ yourRole: 'maker' });
  });

  it('rejects an unknown action, and turns a refused step into a conflict with the reason', async () => {
    await expect(controller.reviewAction(5, { action: 'DELETE' }, req())).rejects.toBeInstanceOf(BadRequestException);
    service.review.mockRejectedValueOnce(new ReviewRefused('Say what needs to change.'));
    await expect(controller.reviewAction(5, { action: 'RETURN' }, req())).rejects.toThrow(ConflictException);
    await controller.reviewAction(5, { action: 'SUBMIT', comment: 'ok' }, req());
    expect(service.review).toHaveBeenLastCalledWith(5, caller, 'maker', 'SUBMIT', 'ok', undefined);
  });
});
