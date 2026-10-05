import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthController } from '../src/modules/auth/auth.controller';

jest.mock('../src/guards/tazama-auth.guard', () => ({ TazamaAuthGuard: class {} }));

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

describe('AuthController session cookie', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock };
  let cacheService: { deleteUserToken: jest.Mock };
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const token = jwt.sign({ clientId: 'user-1', tenantId: 'TAZAMA' }, 'test-secret');
  const requestWith = (cookies?: Record<string, string>): Request => ({ cookies }) as unknown as Request;

  beforeEach(() => {
    authService = { login: jest.fn().mockResolvedValue({ token, expiresIn: 3600 }) };
    cacheService = { deleteUserToken: jest.fn().mockResolvedValue(undefined) };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
    const configService = {
      getOrThrow: jest.fn((key: string) => (key === 'SESSION_COOKIE_SECURE' ? 'true' : 'lax')),
    };
    controller = new AuthController(
      authService as any,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
      cacheService as any,
      configService as any,
    );
  });

  describe('login', () => {
    it('sets exactly one cookie named access_token, regardless of the user id', async () => {
      await controller.login({ username: 'u', password: 'p' } as any, requestWith({}), res as unknown as Response);

      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith('access_token', token, { ...COOKIE_OPTIONS, maxAge: 3600 * 1000 });
    });

    it('clears leftover per-user access_token_* cookies from earlier logins', async () => {
      const req = requestWith({ access_token_old: 'a', access_token_other: 'b', access_token: 'c', unrelated: 'd' });

      await controller.login({ username: 'u', password: 'p' } as any, req, res as unknown as Response);

      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token_old', COOKIE_OPTIONS);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token_other', COOKIE_OPTIONS);
    });

    it('does not fail when the request carries no cookies at all', async () => {
      await expect(controller.login({ username: 'u', password: 'p' } as any, requestWith(undefined), res as unknown as Response)).resolves.toBeDefined();
    });
  });

  describe('logout', () => {
    const user = { userId: 'user-1' } as any;

    it('clears the access_token cookie and the cached token', async () => {
      await controller.logout(requestWith({}), res as unknown as Response, user);

      expect(res.clearCookie).toHaveBeenCalledTimes(1);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', COOKIE_OPTIONS);
      expect(cacheService.deleteUserToken).toHaveBeenCalledWith('user-1');
    });

    it('also clears any legacy per-user cookies still in the browser', async () => {
      await controller.logout(requestWith({ access_token_old: 'a', access_token: 'c' }), res as unknown as Response, user);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', COOKIE_OPTIONS);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token_old', COOKIE_OPTIONS);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
