import { describe, it, expect, vi } from 'vitest';
import CryptoJS from 'crypto-js';

// Mock the crypto module entirely
vi.mock('@/shared/utils/crypto', () => {
  const mockKey = 'test-secret-key-123';

  return {
    encrypt: (data: unknown): string => {
      const stringified = JSON.stringify(data);
      return CryptoJS.AES.encrypt(stringified, mockKey).toString();
    },
    decrypt: (encryptedData: string): unknown => {
      const bytes = CryptoJS.AES.decrypt(encryptedData, mockKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error('Failed to decrypt data');
      }
      return JSON.parse(decryptedString) as unknown;
    },
  };
});

import * as AuthComponents from '../index';

describe('shared/components/auth/index', () => {
  it('exports RoleGuard', () => {
    expect(AuthComponents.RoleGuard).toBeDefined();
  });

  it('exports SupervisorOnly', () => {
    expect(AuthComponents.SupervisorOnly).toBeDefined();
  });

  it('exports InvestigatorOnly', () => {
    expect(AuthComponents.InvestigatorOnly).toBeDefined();
  });

  it('exports AdminOnly', () => {
    expect(AuthComponents.AdminOnly).toBeDefined();
  });

  it('exports SupervisorOrAdmin', () => {
    expect(AuthComponents.SupervisorOrAdmin).toBeDefined();
  });

  it('exports AuthenticatedOnly', () => {
    expect(AuthComponents.AuthenticatedOnly).toBeDefined();
  });
});
