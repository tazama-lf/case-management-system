import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cookies from 'js-cookie';

// Mock crypto module
vi.mock('../crypto', () => ({
  encrypt: vi.fn((data: unknown) => `encrypted:${JSON.stringify(data)}`),
  decrypt: vi.fn((data: string) => {
    const stripped = data.replace('encrypted:', '');
    return JSON.parse(stripped);
  }),
}));

vi.mock('js-cookie', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

import {
  insertData,
  extractData,
  removeData,
  getAuthToken,
  resetData,
} from '../storage';
import { CookieStorage, LocalStorage, SessionStorage } from '../enums';

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('insertData', () => {
    it('stores encrypted data in sessionStorage by default', () => {
      insertData('test-value', 'key1');
      expect(sessionStorage.getItem('key1')).toBe('encrypted:"test-value"');
    });

    it('stores encrypted data in localStorage', () => {
      insertData('test-value', 'key1', LocalStorage);
      expect(localStorage.getItem('key1')).toBe('encrypted:"test-value"');
    });

    it('stores encrypted data in cookies', () => {
      insertData('test-value', 'key1', CookieStorage);
      expect(Cookies.set).toHaveBeenCalledWith(
        'key1',
        'encrypted:"test-value"',
        {},
      );
    });

    it('stores unencrypted data when encrypted=false', () => {
      insertData({ foo: 'bar' }, 'key1', SessionStorage, false);
      expect(sessionStorage.getItem('key1')).toBe('{"foo":"bar"}');
    });

    it('passes cookie options when using CookieStorage', () => {
      const opts = { path: '/', secure: true };
      insertData('val', 'key1', CookieStorage, true, opts);
      expect(Cookies.set).toHaveBeenCalledWith('key1', 'encrypted:"val"', opts);
    });

    it('stores data in sessionStorage explicitly', () => {
      insertData('data', 'skey', SessionStorage);
      expect(sessionStorage.getItem('skey')).toBe('encrypted:"data"');
    });
  });

  describe('extractData', () => {
    it('extracts encrypted data from sessionStorage by default', () => {
      sessionStorage.setItem('key1', 'encrypted:"hello"');
      const result = extractData('key1');
      expect(result).toBe('hello');
    });

    it('extracts data from localStorage', () => {
      localStorage.setItem('key1', 'encrypted:"world"');
      const result = extractData('key1', LocalStorage);
      expect(result).toBe('world');
    });

    it('extracts data from cookies', () => {
      (Cookies.get as ReturnType<typeof vi.fn>).mockReturnValue('encrypted:42');
      const result = extractData('key1', CookieStorage);
      expect(result).toBe(42);
    });

    it('returns null when key does not exist in sessionStorage', () => {
      const result = extractData('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when cookie key does not exist', () => {
      (Cookies.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      const result = extractData('nonexistent', CookieStorage);
      expect(result).toBeNull();
    });

    it('returns null when localStorage key does not exist', () => {
      const result = extractData('nonexistent', LocalStorage);
      expect(result).toBeNull();
    });

    it('parses unencrypted JSON when encrypted=false', () => {
      sessionStorage.setItem('key1', '{"a":1}');
      const result = extractData('key1', SessionStorage, false);
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('removeData', () => {
    it('removes from sessionStorage by default', () => {
      sessionStorage.setItem('key1', 'value');
      removeData('key1');
      expect(sessionStorage.getItem('key1')).toBeNull();
    });

    it('removes from localStorage', () => {
      localStorage.setItem('key1', 'value');
      removeData('key1', LocalStorage);
      expect(localStorage.getItem('key1')).toBeNull();
    });

    it('removes from cookies', () => {
      removeData('key1', CookieStorage);
      expect(Cookies.remove).toHaveBeenCalledWith('key1', {});
    });

    it('passes cookie options when removing from cookies', () => {
      const opts = { path: '/' };
      removeData('key1', CookieStorage, opts);
      expect(Cookies.remove).toHaveBeenCalledWith('key1', opts);
    });
  });

  describe('getAuthToken', () => {
    it('extracts access_token from sessionStorage', () => {
      sessionStorage.setItem('access_token', 'encrypted:"my-token"');
      const result = getAuthToken();
      expect(result).toBe('my-token');
    });

    it('returns null when no access_token exists', () => {
      const result = getAuthToken();
      expect(result).toBeNull();
    });
  });

  describe('resetData', () => {
    it('clears sessionStorage, localStorage, and all cookies', () => {
      sessionStorage.setItem('a', '1');
      localStorage.setItem('b', '2');
      (Cookies.get as ReturnType<typeof vi.fn>).mockReturnValue({
        cookie1: 'val1',
        cookie2: 'val2',
      });

      resetData();

      expect(sessionStorage.length).toBe(0);
      expect(localStorage.length).toBe(0);
      expect(Cookies.remove).toHaveBeenCalledWith('cookie1');
      expect(Cookies.remove).toHaveBeenCalledWith('cookie2');
    });
  });
});
