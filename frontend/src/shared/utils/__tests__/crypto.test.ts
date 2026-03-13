import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env before importing
vi.stubEnv('VITE_CRYPTO_KEY', 'test-secret-key-12345');

const { encrypt, decrypt } = await import('../crypto');

describe('crypto', () => {
  it('encrypts and decrypts a string', () => {
    const data = 'hello world';
    const encrypted = encrypt(data);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(JSON.stringify(data));

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(data);
  });

  it('encrypts and decrypts an object', () => {
    const data = { user: 'admin', role: 'supervisor' };
    const encrypted = encrypt(data);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('encrypts and decrypts a number', () => {
    const data = 42;
    const encrypted = encrypt(data);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(data);
  });

  it('encrypts and decrypts null', () => {
    const encrypted = encrypt(null);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBeNull();
  });

  it('encrypts and decrypts an array', () => {
    const data = [1, 'two', { three: 3 }];
    const encrypted = encrypt(data);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('throws when decrypting invalid data', () => {
    expect(() => decrypt('invalid-data')).toThrow();
  });

  it('produces different ciphertext for same input', () => {
    const data = 'test';
    // CryptoJS AES produces different ciphertext each time due to random IV
    const e1 = encrypt(data);
    const e2 = encrypt(data);
    // Both should decrypt to same value
    expect(decrypt(e1)).toBe(data);
    expect(decrypt(e2)).toBe(data);
  });

  it('throws when VITE_CRYPTO_KEY is not defined', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CRYPTO_KEY', '');

    await expect(import('../crypto')).rejects.toThrow(
      'VITE_CRYPTO_KEY is not defined',
    );

    // Restore so other tests still work
    vi.stubEnv('VITE_CRYPTO_KEY', 'test-secret-key-12345');
  });
});
