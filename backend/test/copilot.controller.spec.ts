import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CopilotController } from '../src/modules/copilot/copilot.controller';

describe('CopilotController', () => {
  const service = {
    status: jest.fn(async () => ({ mode: 'off' })),
    latestInvestigation: jest.fn(async () => null),
    investigate: jest.fn(async () => ({ id: 1 })),
    ask: jest.fn(async () => ({ recordId: 1 })),
    latestSar: jest.fn(async () => null),
    draftSar: jest.fn(async () => ({ id: 2 })),
  };
  const access = { assertReadAccess: jest.fn(async () => undefined) };
  const controller = new CopilotController(service as any, access as any);
  const req = (tenantId?: string): any => ({ user: { token: { clientId: 'u1', tenantId }, actorRole: 'CMS_INVESTIGATOR', actorName: 'Ayesha', actorEmail: 'a@x.org' } });

  it('passes the caller and tenant from the token', async () => {
    await controller.investigate(5, req('TAZAMA'));
    expect(service.investigate).toHaveBeenCalledWith(5, { userId: 'u1', tenantId: 'TAZAMA', name: 'Ayesha', email: 'a@x.org' });
    await controller.latest(5, req('TAZAMA'));
    expect(service.latestInvestigation).toHaveBeenCalledWith(5, 'TAZAMA');
    await controller.latestSar(5, req('TAZAMA'));
    await controller.draftSar(5, { refresh: true }, req('TAZAMA'));
    expect(service.draftSar).toHaveBeenCalledWith(5, expect.objectContaining({ tenantId: 'TAZAMA' }), true);
    expect(await controller.status()).toEqual({ mode: 'off' });
  });

  it('trims and caps questions, and rejects empty ones or a missing tenant', async () => {
    await controller.ask(5, { question: `  ${'x'.repeat(600)} ` }, req('TAZAMA'));
    expect((service.ask.mock.calls[0] as any[])[2]).toHaveLength(500);
    await expect(controller.ask(5, { question: '  ' }, req('TAZAMA'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.investigate(5, req())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks the case ACL first, with the caller, tenant and role', async () => {
    await controller.latest(5, req('TAZAMA'));
    expect(access.assertReadAccess).toHaveBeenCalledWith(5, 'u1', 'TAZAMA', 'CMS_INVESTIGATOR');
  });

  it('refuses every case endpoint, and reads nothing, when the caller has no access to the case', async () => {
    access.assertReadAccess.mockRejectedValue(new NotFoundException('Case not found or access denied'));
    service.latestInvestigation.mockClear();
    service.investigate.mockClear();
    service.draftSar.mockClear();
    await expect(controller.latest(9, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.investigate(9, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.ask(9, { question: 'why?' }, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.latestSar(9, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.draftSar(9, {}, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.review(9, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.reviewAction(9, { action: 'SUBMIT' }, req('TAZAMA'))).rejects.toBeInstanceOf(NotFoundException);
    expect(service.latestInvestigation).not.toHaveBeenCalled();
    expect(service.investigate).not.toHaveBeenCalled();
    expect(service.draftSar).not.toHaveBeenCalled();
    access.assertReadAccess.mockResolvedValue(undefined);
  });
});
