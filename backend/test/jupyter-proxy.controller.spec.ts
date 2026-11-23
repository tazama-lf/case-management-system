import { BadRequestException } from '@nestjs/common';
import { JupyterProxyController } from '../src/modules/jupyter/jupyter-proxy.controller';

jest.mock('../src/guards/tazama-auth.guard', () => ({ TazamaAuthGuard: class {} }));

const USER_ID = 'user-1';
const JWT = 'request-jwt';

describe('JupyterProxyController', () => {
  let controller: JupyterProxyController;
  let proxyService: { getConditionsContextByTransaction: jest.Mock };

  const request = { user: { userId: USER_ID, token: { tokenString: JWT } } } as any;

  beforeEach(() => {
    proxyService = { getConditionsContextByTransaction: jest.fn().mockResolvedValue({ transaction: { transactionId: 'TXN-1' } }) };
    controller = new JupyterProxyController(proxyService as any);
  });

  describe('getConditionsContextByTransaction: asOf', () => {
    it('rejects an unknown asOf with a 400 and never reaches the service', async () => {
      const result = controller.getConditionsContextByTransaction(request, 'TXN-1', 'DEFAULT', undefined, 'foo');

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('Invalid asOf. Must be one of: now, transaction');
      expect(proxyService.getConditionsContextByTransaction).not.toHaveBeenCalled();
    });

    it("passes asOf = 'transaction' to the service, together with the user, the tenant and the request JWT", async () => {
      const result = await controller.getConditionsContextByTransaction(request, 'TXN-1', 'DEFAULT', undefined, 'transaction');

      expect(result).toEqual({ transaction: { transactionId: 'TXN-1' } });
      expect(proxyService.getConditionsContextByTransaction).toHaveBeenCalledTimes(1);
      expect(proxyService.getConditionsContextByTransaction).toHaveBeenCalledWith(USER_ID, 'TXN-1', 'DEFAULT', undefined, JWT, 'transaction');
    });

    it("passes asOf = 'now' to the service", async () => {
      await controller.getConditionsContextByTransaction(request, 'TXN-1', 'DEFAULT', undefined, 'now');

      expect(proxyService.getConditionsContextByTransaction).toHaveBeenCalledWith(USER_ID, 'TXN-1', 'DEFAULT', undefined, JWT, 'now');
    });

    it('leaves asOf undefined when it is not given, so the service default (now) applies', async () => {
      await controller.getConditionsContextByTransaction(request, 'TXN-1', 'DEFAULT');

      expect(proxyService.getConditionsContextByTransaction).toHaveBeenCalledWith(USER_ID, 'TXN-1', 'DEFAULT', undefined, JWT, undefined);
    });

    it('still passes an explicit asOfDate along with asOf', async () => {
      await controller.getConditionsContextByTransaction(request, 'TXN-1', 'DEFAULT', '2026-07-01T00:00:00.000Z', 'transaction');

      expect(proxyService.getConditionsContextByTransaction).toHaveBeenCalledWith(
        USER_ID,
        'TXN-1',
        'DEFAULT',
        '2026-07-01T00:00:00.000Z',
        JWT,
        'transaction',
      );
    });
  });
});
