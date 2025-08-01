import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import * as fs from 'fs';

// Mock fs
jest.mock('fs');

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const mockPublicKey =
    '-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----';
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.AUTH_PUBLIC_KEY_PATH = '/path/to/public.key';

    (fs.readFileSync as jest.Mock).mockReturnValue(mockPublicKey);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize successfully with valid environment', () => {
      expect(() => {
        strategy = new JwtStrategy();
      }).not.toThrow();
    });

    it('should throw error when AUTH_PUBLIC_KEY_PATH is not set', () => {
      delete process.env.AUTH_PUBLIC_KEY_PATH;

      expect(() => {
        new JwtStrategy();
      }).toThrow('AUTH_PUBLIC_KEY_PATH environment variable is not set');
    });

    it('should throw error when public key file is not readable', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => {
        new JwtStrategy();
      }).toThrow('Public key file not found or unreadable');
    });

    it('should throw error when public key is empty', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('');

      expect(() => {
        new JwtStrategy();
      }).toThrow('Public key for JWT verification is not set');
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      strategy = new JwtStrategy();
    });

    it('should validate payload with realm_access roles', async () => {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        realm_access: {
          roles: ['admin', 'user'],
        },
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        role: ['admin', 'user'],
        permissions: ['admin', 'user'],
        tenantId: 'tenant-456',
        user_id: 'user-123',
      });
    });

    it('should validate payload with claims instead of realm_access', async () => {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        claims: ['CMS-TEST-ROLE', 'manage-account'],
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        role: ['CMS-TEST-ROLE', 'manage-account'],
        permissions: ['CMS-TEST-ROLE', 'manage-account'],
        tenantId: 'tenant-456',
        user_id: 'user-123',
      });
    });

    it('should validate payload with clientId instead of sub', async () => {
      const payload: any = {
        clientId: 'client-789',
        tenant_id: 'tenant-456',
        realm_access: {
          roles: ['client'],
        },
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        role: ['client'],
        permissions: ['client'],
        tenantId: 'tenant-456',
        user_id: 'client-789',
      });
    });

    it('should validate payload with tenant_id instead of tenantId', async () => {
      const payload = {
        sub: 'user-123',
        tenant_id: 'tenant-789',
        claims: ['user'],
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        role: ['user'],
        permissions: ['user'],
        tenantId: 'tenant-789',
        user_id: 'user-123',
      });
    });

    it('should throw error when user_id is missing', async () => {
      const payload: any = {
        tenantId: 'tenant-456',
        realm_access: {
          roles: ['user'],
        },
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token: missing sub user_id or clientId',
      );
    });

    it('should throw error when tenantId is missing', async () => {
      const payload = {
        sub: 'user-123',
        realm_access: {
          roles: ['user'],
        },
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token: missing tenant_id or tenantId',
      );
    });

    it('should throw error when roles are missing', async () => {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token: missing roles in realm_access or claims',
      );
    });

    it('should throw error when roles array is empty', async () => {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        realm_access: {
          roles: [],
        },
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        'Invalid token: missing roles in realm_access or claims',
      );
    });

    it('should handle complex payload with additional properties', async () => {
      const payload = {
        sub: 'user-123',
        tenantId: 'tenant-456',
        realm_access: {
          roles: ['admin', 'user'],
        },
        username: 'testuser',
        email: 'test@example.com',
        exp: 1234567890,
        iat: 1234567800,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        role: ['admin', 'user'],
        permissions: ['admin', 'user'],
        tenantId: 'tenant-456',
        user_id: 'user-123',
      });
    });
  });
});
