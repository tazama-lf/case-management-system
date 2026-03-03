import { decrypt, encrypt } from './crypto';
import {
  CookieStorage,
  LocalStorage,
  SessionStorage,
  type StorageType,
} from './enums';
import Cookies from 'js-cookie';

const insertData = (
  data: unknown,
  key: string,
  type: StorageType = SessionStorage,
  encrypted = true,
  cookieOptions?: Cookies.CookieAttributes,
): void => {
  const value: string = encrypted ? encrypt(data) : JSON.stringify(data);

  switch (type) {
    case CookieStorage:
      Cookies.set(key, value, {
        ...cookieOptions,
      });
      break;

    case SessionStorage:
      sessionStorage.setItem(key, value);
      break;

    case LocalStorage:
      localStorage.setItem(key, value);
      break;
  }
};

const extractData = (
  key: string,
  type: StorageType = SessionStorage,
  encrypted = true,
): unknown => {
  let data: string | null | undefined;

  switch (type) {
    case CookieStorage:
      data = Cookies.get(key);
      break;

    case SessionStorage:
      data = sessionStorage.getItem(key);
      break;

    case LocalStorage:
      data = localStorage.getItem(key);
      break;
  }

  if (!data) return null;

  if (encrypted) {
    return decrypt(data);
  }

  return JSON.parse(data) as unknown;
};

const removeData = (
  key: string,
  type: StorageType = SessionStorage,
  cookieOptions?: Cookies.CookieAttributes,
): void => {
  switch (type) {
    case CookieStorage:
      Cookies.remove(key, {
        ...cookieOptions,
      });
      break;

    case SessionStorage:
      sessionStorage.removeItem(key);
      break;

    case LocalStorage:
      localStorage.removeItem(key);
      break;
  }
};

const getAuthToken = (): unknown => extractData('access_token');

const resetData = (): void => {
  sessionStorage.clear();
  localStorage.clear();
  const allCookies = Cookies.get();
  Object.keys(allCookies).forEach((key) => {
    Cookies.remove(key);
  });
};

export { extractData, insertData, resetData, getAuthToken, removeData };
