import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertData, extractData, removeData, resetData, getAuthToken } from '../storage';
import { CookieStorage, LocalStorage, SessionStorage } from '../enums';
import Cookies from 'js-cookie';

vi.mock('../crypto', () => ({
  encrypt: vi.fn((data: unknown) => `encrypted:${JSON.stringify(data)}`),
  decrypt: vi.fn((data: string) => JSON.parse(data.replace('encrypted:', ''))),
}));

vi.mock('js-cookie', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  // ─── insertData ─────────────────────────────────────────────

  describe('insertData', () => {
    it('stores encrypted data in SessionStorage by default', () => {
      insertData({ user: 'admin' }, 'testKey');
      expect(sessionStorage.getItem('testKey')).toBe('encrypted:{"user":"admin"}');
    });

    it('stores encrypted data in LocalStorage', () => {
      insertData('value', 'key1', LocalStorage);
      expect(localStorage.getItem('key1')).toBe('encrypted:"value"');
    });

    it('stores encrypted data in CookieStorage', () => {
      insertData('value', 'cookieKey', CookieStorage);
      expect(Cookies.set).toHaveBeenCalledWith('cookieKey', 'encrypted:"value"', {});
    });

    it('stores unencrypted data when encrypted=false', () => {
      insertData({ foo: 'bar' }, 'plainKey', SessionStorage, false);
      expect(sessionStorage.getItem('plainKey')).toBe('{"foo":"bar"}');
    });

    it('passes cookie options to Cookies.set', () => {
      const opts = { expires: 7, path: '/' };
      insertData('val', 'ck', CookieStorage, true, opts);
      expect(Cookies.set).toHaveBeenCalledWith('ck', expect.any(String), opts);
    });
  });

  // ─── extractData ────────────────────────────────────────────

  describe('extractData', () => {
    it('extracts encrypted data from SessionStorage by default', () => {
      sessionStorage.setItem('testKey', 'encrypted:{"user":"admin"}');
      const result = extractData('testKey');
      expect(result).toEqual({ user: 'admin' });
    });

    it('extracts encrypted data from LocalStorage', () => {
      localStorage.setItem('lsKey', 'encrypted:"hello"');
      const result = extractData('lsKey', LocalStorage);
      expect(result).toBe('hello');
    });

    it('extracts encrypted data from CookieStorage', () => {
      vi.mocked(Cookies.get).mockReturnValue('encrypted:42' as any);
      const result = extractData('ck', CookieStorage);
      expect(result).toBe(42);
    });

    it('extracts unencrypted data when encrypted=false', () => {
      sessionStorage.setItem('plainKey', '{"foo":"bar"}');
      const result = extractData('plainKey', SessionStorage, false);
      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns null when key is not found in SessionStorage', () => {
      const result = extractData('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when key is not found in LocalStorage', () => {
      const result = extractData('nonexistent', LocalStorage);
      expect(result).toBeNull();
    });

    it('returns null when cookie key is not found', () => {
      vi.mocked(Cookies.get).mockReturnValue(undefined as any);
      const result = extractData('nope', CookieStorage);
      expect(result).toBeNull();
    });
  });

  // ─── removeData ─────────────────────────────────────────────

  describe('removeData', () => {
    it('removes data from SessionStorage by default', () => {
      sessionStorage.setItem('rmKey', 'val');
      removeData('rmKey');
      expect(sessionStorage.getItem('rmKey')).toBeNull();
    });

    it('removes data from LocalStorage', () => {
      localStorage.setItem('rmKey', 'val');
      removeData('rmKey', LocalStorage);
      expect(localStorage.getItem('rmKey')).toBeNull();
    });

    it('removes cookie', () => {
      removeData('ck', CookieStorage);
      expect(Cookies.remove).toHaveBeenCalledWith('ck', {});
    });

    it('passes cookie options to Cookies.remove', () => {
      const opts = { path: '/' };
      removeData('ck', CookieStorage, opts);
      expect(Cookies.remove).toHaveBeenCalledWith('ck', opts);
    });
  });

  // ─── getAuthToken ───────────────────────────────────────────

  describe('getAuthToken', () => {
    it('returns decrypted access_token from SessionStorage', () => {
      sessionStorage.setItem('access_token', 'encrypted:"my-token"');
      const result = getAuthToken();
      expect(result).toBe('my-token');
    });

    it('returns null when no access_token exists', () => {
      const result = getAuthToken();
      expect(result).toBeNull();
    });
  });

  // ─── resetData ──────────────────────────────────────────────

  describe('resetData', () => {
    it('clears all storage types', () => {
      sessionStorage.setItem('a', 'b');
      localStorage.setItem('c', 'd');
      vi.mocked(Cookies.get).mockReturnValue({ cookieA: 'v1', cookieB: 'v2' } as any);

      resetData();

      expect(sessionStorage.length).toBe(0);
      expect(localStorage.length).toBe(0);
      expect(Cookies.remove).toHaveBeenCalledWith('cookieA');
      expect(Cookies.remove).toHaveBeenCalledWith('cookieB');
    });
  });
});
