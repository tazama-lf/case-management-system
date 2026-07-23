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

// Test that all exports from index.ts are available
describe('auth/index.ts exports', () => {
  it('exports ProtectedRoute component', async () => {
    const module = await import('../index');
    expect(module.ProtectedRoute).toBeDefined();
  }, 25000);

  it('exports AuthProvider and useAuth', async () => {
    const module = await import('../index');
    expect(module.AuthProvider).toBeDefined();
    expect(module.useAuth).toBeDefined();
  }, 25000);

  it('exports auth types', async () => {
    const module = await import('../index');
    // Types are compile-time only, but we can verify the module loads
    expect(module).toBeDefined();
  }, 25000);

  it('exports authService', async () => {
    const module = await import('../index');
    expect(module.authService).toBeDefined();
  }, 25000);

  it('exports Login page component', async () => {
    const module = await import('../index');
    expect(module.Login).toBeDefined();
  }, 25000);
});
