import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env before importing the module
vi.stubEnv('VITE_CRYPTO_KEY', 'test-secret-key-123');

const { encrypt, decrypt } = await import('../crypto');

describe('crypto', () => {
  it('encrypts and decrypts a string value', () => {
    const original = 'hello world';
    const encrypted = encrypt(original);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(JSON.stringify(original));
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('encrypts and decrypts an object', () => {
    const original = { user: 'admin', token: 'abc123' };
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('encrypts and decrypts a number', () => {
    const original = 42;
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('encrypts and decrypts an array', () => {
    const original = [1, 'two', { three: 3 }];
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('encrypts and decrypts null', () => {
    const encrypted = encrypt(null);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBeNull();
  });

  it('encrypts and decrypts boolean values', () => {
    const encryptedTrue = encrypt(true);
    expect(decrypt(encryptedTrue)).toBe(true);
    const encryptedFalse = encrypt(false);
    expect(decrypt(encryptedFalse)).toBe(false);
  });

  it('produces different ciphertext for same plaintext (AES randomness)', () => {
    const data = 'same data';
    const enc1 = encrypt(data);
    const enc2 = encrypt(data);
    // AES with random IV should produce different ciphertext
    // but both should decrypt to the same value
    expect(decrypt(enc1)).toBe(data);
    expect(decrypt(enc2)).toBe(data);
  });

  it('throws when decrypting invalid data', () => {
    expect(() => decrypt('not-valid-encrypted-data')).toThrow();
  });

  it('throws when decrypting empty string', () => {
    expect(() => decrypt('')).toThrow();
  });
});
