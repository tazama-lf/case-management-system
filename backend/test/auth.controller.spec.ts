import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthController } from '../src/modules/auth/auth.controller';

jest.mock('../src/guards/tazama-auth.guard', () => ({ TazamaAuthGuard: class {} }));

const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

describe('AuthController session cookie', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock };
  let cacheService: { deleteUserToken: jest.Mock; refreshDirectoryIfUnknown: jest.Mock };
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const token = jwt.sign({ clientId: 'user-1', tenantId: 'TAZAMA' }, 'test-secret');
  const requestWith = (cookies?: Record<string, string>): Request => ({ cookies }) as unknown as Request;

  beforeEach(() => {
    authService = { login: jest.fn().mockResolvedValue({ token, expiresIn: 3600 }) };
    cacheService = { deleteUserToken: jest.fn().mockResolvedValue(undefined), refreshDirectoryIfUnknown: jest.fn().mockResolvedValue(undefined) };
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

    it('clears the cookie when it was issued to the user logging out', async () => {
      await controller.logout(requestWith({ access_token: token }), res as unknown as Response, user);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', COOKIE_OPTIONS);
    });

    it('leaves the cookie alone when a newer login by a different user already replaced it', async () => {
      const newerUsersToken = jwt.sign({ clientId: 'user-2', tenantId: 'PAYSYSLABS' }, 'test-secret');

      await controller.logout(requestWith({ access_token: newerUsersToken }), res as unknown as Response, user);

      expect(res.clearCookie).not.toHaveBeenCalledWith('access_token', expect.anything());
      expect(cacheService.deleteUserToken).toHaveBeenCalledWith('user-1');
    });

    it('still clears an undecodable cookie', async () => {
      await controller.logout(requestWith({ access_token: 'not-a-jwt' }), res as unknown as Response, user);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', COOKIE_OPTIONS);
    });

    it('also clears any legacy per-user cookies still in the browser', async () => {
      await controller.logout(requestWith({ access_token_old: 'a', access_token: 'c' }), res as unknown as Response, user);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', COOKIE_OPTIONS);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token_old', COOKIE_OPTIONS);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('me - repairs the user directory', () => {
    const me = { userId: 'user-1', tenantId: 'T', tenantName: 'tn', actorName: 'Sam Visor', actorEmail: 's@x.org', validated: {} } as any;
    const requestWithAuth = (headers: Record<string, string>, cookies?: Record<string, string>): Request =>
      ({ headers, cookies }) as unknown as Request;

    it('asks for a directory refresh using the bearer token, and still returns the user', () => {
      const result = controller.getMe(me, requestWithAuth({ authorization: 'Bearer the-jwt' }));

      expect(cacheService.refreshDirectoryIfUnknown).toHaveBeenCalledWith('user-1', 'the-jwt');
      expect(result).toMatchObject({ clientId: 'user-1', fullName: 'Sam Visor' });
    });

    it('falls back to the session cookie when there is no bearer header', () => {
      controller.getMe(me, requestWithAuth({}, { access_token: 'cookie-jwt' }));

      expect(cacheService.refreshDirectoryIfUnknown).toHaveBeenCalledWith('user-1', 'cookie-jwt');
    });

    it('does not refresh when the request carries no token at all', () => {
      controller.getMe(me, requestWithAuth({}, {}));

      expect(cacheService.refreshDirectoryIfUnknown).not.toHaveBeenCalled();
    });

    it('is unchanged when called without a request (existing callers)', () => {
      expect(controller.getMe(me)).toMatchObject({ clientId: 'user-1' });
      expect(cacheService.refreshDirectoryIfUnknown).not.toHaveBeenCalled();
    });

    it('never fails the response when the refresh itself rejects', async () => {
      cacheService.refreshDirectoryIfUnknown.mockRejectedValueOnce(new Error('auth service down'));

      expect(() => controller.getMe(me, requestWithAuth({ authorization: 'Bearer the-jwt' }))).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
    });
  });
});
