import { BadRequestException } from '@nestjs/common';
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
  const controller = new CopilotController(service as any);
  const req = (tenantId?: string): any => ({ user: { token: { clientId: 'u1', tenantId }, actorName: 'Ayesha', actorEmail: 'a@x.org' } });

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
});
