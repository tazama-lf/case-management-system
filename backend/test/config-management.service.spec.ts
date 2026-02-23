import { Test, TestingModule } from '@nestjs/testing';
import { ConfigManagementService } from '../src/modules/config-management/config-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';

describe('ConfigManagementService', () => {
  let service: ConfigManagementService;
  let prismaService: PrismaService;
  let auditLogService: AuditLogService;
  let loggerService: LoggerService;

  const mockPrismaService = {
    rolePermission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    integrationConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    configurationChangeLog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    systemConfiguration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
  };

  const mockLoggerService = {
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigManagementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<ConfigManagementService>(ConfigManagementService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);
    loggerService = module.get(LoggerService);

    // Set encryption key for testing
    process.env.CONFIG_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should warn if encryption key is not 64 characters', () => {
      process.env.CONFIG_ENCRYPTION_KEY = 'short-key';
      
      new ConfigManagementService(prismaService, auditLogService, loggerService);
      
      expect(loggerService.warn).toHaveBeenCalledWith(
        'CONFIG_ENCRYPTION_KEY should be 64 hex characters (32 bytes)',
      );
    });

    it('should not warn if encryption key is 64 characters', () => {
      process.env.CONFIG_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      
      jest.clearAllMocks();
      new ConfigManagementService(prismaService, auditLogService, loggerService);
      
      expect(loggerService.warn).not.toHaveBeenCalled();
    });
  });

  describe('configureRole', () => {
    it('should create new role without 2FA', async () => {
      const roleName = 'TEST_ROLE';
      const permissions = ['READ', 'WRITE'];
      const description = 'Test role';
      const userId = 'user123';

      mockPrismaService.rolePermission.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 1 });
      mockPrismaService.rolePermission.upsert.mockResolvedValue({
        id: 1,
        role_name: roleName,
        permissions,
        description,
        created_by: userId,
        updated_by: userId,
      });

      const result = await service.configureRole(roleName, permissions, description, userId, false);

      expect(mockPrismaService.rolePermission.upsert).toHaveBeenCalled();
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'CONFIGURE_ROLE',
          outcome: 'SUCCESS',
        }),
      );
      expect(result).toHaveProperty('role_name', roleName);
    });

    it('should return PENDING_2FA status when require2FA is true', async () => {
      const roleName = 'TEST_ROLE';
      const permissions = ['READ'];
      const description = 'Test';
      const userId = 'user123';

      mockPrismaService.rolePermission.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 5 });

      const result = await service.configureRole(roleName, permissions, description, userId, true);

      expect(result).toEqual({
        status: 'PENDING_2FA',
        changeId: 5,
        message: 'Role configuration pending 2FA verification',
      });
    });

    it('should throw BadRequestException if role name is too short', async () => {
      await expect(
        service.configureRole('ab', ['READ'], 'Test', 'user123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if permissions array is empty', async () => {
      await expect(
        service.configureRole('TEST_ROLE', [], 'Test', 'user123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when trying to modify system role', async () => {
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        role_name: 'ADMIN',
        is_system_role: true,
      });

      await expect(
        service.configureRole('ADMIN', ['READ'], 'Test', 'user123', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update existing role', async () => {
      const roleName = 'EXISTING_ROLE';
      const oldPermissions = ['READ'];
      const newPermissions = ['READ', 'WRITE'];

      mockPrismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        role_name: roleName,
        permissions: oldPermissions,
        is_system_role: false,
      });
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 2 });
      mockPrismaService.rolePermission.upsert.mockResolvedValue({
        id: 1,
        role_name: roleName,
        permissions: newPermissions,
      });

      const result = await service.configureRole(roleName, newPermissions, 'Updated', 'user123', false);

      expect(result).toHaveProperty('permissions', newPermissions);
    });

    it('should log failure on error', async () => {
      mockPrismaService.rolePermission.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.configureRole('TEST', ['READ'], 'Test', 'user123', false),
      ).rejects.toThrow();

      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });

  describe('getRolePermissions', () => {
    it('should return role permissions', async () => {
      const roleData = {
        id: 1,
        role_name: 'TEST_ROLE',
        permissions: ['READ', 'WRITE'],
      };

      mockPrismaService.rolePermission.findUnique.mockResolvedValue(roleData);

      const result = await service.getRolePermissions('TEST_ROLE');

      expect(result).toEqual(roleData);
    });

    it('should throw NotFoundException if role not found', async () => {
      mockPrismaService.rolePermission.findUnique.mockResolvedValue(null);

      await expect(service.getRolePermissions('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAllRoles', () => {
    it('should return list of active roles', async () => {
      const roles = [
        { id: 1, role_name: 'ROLE1', permissions: ['READ'], is_active: true },
        { id: 2, role_name: 'ROLE2', permissions: ['WRITE'], is_active: true },
      ];

      mockPrismaService.rolePermission.findMany.mockResolvedValue(roles);

      const result = await service.listAllRoles();

      expect(result).toEqual(roles);
      expect(mockPrismaService.rolePermission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { is_active: true },
          orderBy: { role_name: 'asc' },
        }),
      );
    });
  });

  describe('deleteRole', () => {
    it('should soft delete role', async () => {
      const roleName = 'TEST_ROLE';
      const roleData = {
        id: 1,
        role_name: roleName,
        is_system_role: false,
        permissions: ['READ'],
      };

      mockPrismaService.rolePermission.findUnique.mockResolvedValue(roleData);
      mockPrismaService.rolePermission.update.mockResolvedValue({ ...roleData, is_active: false });
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 1 });

      const result = await service.deleteRole(roleName, 'user123');

      expect(mockPrismaService.rolePermission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role_name: roleName },
          data: expect.objectContaining({ is_active: false }),
        }),
      );
      expect(result).toEqual({ message: `Role ${roleName} deleted successfully` });
    });

    it('should throw NotFoundException if role not found', async () => {
      mockPrismaService.rolePermission.findUnique.mockResolvedValue(null);

      await expect(service.deleteRole('NONEXISTENT', 'user123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting system role', async () => {
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        role_name: 'ADMIN',
        is_system_role: true,
      });

      await expect(service.deleteRole('ADMIN', 'user123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('configureIntegration', () => {
    it('should configure new integration with encrypted secrets', async () => {
      const systemName = 'ALERT_TRIAGE';
      const config = {
        endpoint_url: 'https://api.example.com',
        api_key: 'test-api-key',
        api_secret: 'test-secret',
        auth_type: 'bearer',
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 1 });
      mockPrismaService.integrationConfig.upsert.mockResolvedValue({
        id: 1,
        system_name: systemName,
        endpoint_url: config.endpoint_url,
        api_key: 'encrypted-key',
        api_secret: 'encrypted-secret',
      });

      const result = await service.configureIntegration(systemName, config, 'user123');

      expect(result.api_key).toBe('***ENCRYPTED***');
      expect(result.api_secret).toBe('***ENCRYPTED***');
      expect(mockAuditLogService.logAction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid system name', async () => {
      await expect(
        service.configureIntegration('INVALID_SYSTEM', {}, 'user123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing integration', async () => {
      const systemName = 'FLOWABLE';
      const existingConfig = {
        id: 1,
        system_name: systemName,
        endpoint_url: 'https://old.example.com',
        auth_type: 'basic',
        is_enabled: true,
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(existingConfig);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 2 });
      mockPrismaService.integrationConfig.upsert.mockResolvedValue({
        ...existingConfig,
        endpoint_url: 'https://new.example.com',
      });

      const result = await service.configureIntegration(
        systemName,
        { endpoint_url: 'https://new.example.com' },
        'user123',
      );

      expect(result.endpoint_url).toBe('https://new.example.com');
    });

    it('should handle config without secrets', async () => {
      const systemName = 'KEYCLOAK';
      const config = {
        endpoint_url: 'https://keycloak.example.com',
        auth_type: 'oauth',
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 3 });
      mockPrismaService.integrationConfig.upsert.mockResolvedValue({
        id: 1,
        system_name: systemName,
        ...config,
        api_key: null,
        api_secret: null,
      });

      const result = await service.configureIntegration(systemName, config, 'user123');

      expect(result.api_key).toBeNull();
      expect(result.api_secret).toBeNull();
    });

    it('should log failure on error', async () => {
      mockPrismaService.integrationConfig.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(
        service.configureIntegration('API_PORTAL', {}, 'user123'),
      ).rejects.toThrow();

      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });

  describe('getIntegrationConfig', () => {
    it('should return integration config with masked secrets', async () => {
      const configData = {
        id: 1,
        system_name: 'FLOWABLE',
        endpoint_url: 'https://flowable.example.com',
        api_key: 'encrypted-api-key',
        api_secret: 'encrypted-secret',
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(configData);

      const result = await service.getIntegrationConfig('FLOWABLE');

      expect(result.api_key).toBe('***ENCRYPTED***');
      expect(result.api_secret).toBe('***ENCRYPTED***');
      expect(result.endpoint_url).toBe(configData.endpoint_url);
    });

    it('should throw NotFoundException if integration not found', async () => {
      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(null);

      await expect(service.getIntegrationConfig('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAllIntegrations', () => {
    it('should return all integrations with masked secrets', async () => {
      const integrations = [
        {
          id: 1,
          system_name: 'FLOWABLE',
          endpoint_url: 'https://flowable.example.com',
          api_key: 'encrypted-key-1',
          api_secret: 'encrypted-secret-1',
        },
        {
          id: 2,
          system_name: 'KEYCLOAK',
          endpoint_url: 'https://keycloak.example.com',
          api_key: null,
          api_secret: null,
        },
      ];

      mockPrismaService.integrationConfig.findMany.mockResolvedValue(integrations);

      const result = await service.listAllIntegrations();

      expect(result).toHaveLength(2);
      expect(result[0].api_key).toBe('***ENCRYPTED***');
      expect(result[1].api_key).toBeNull();
    });
  });

  describe('toggleIntegration', () => {
    it('should enable integration', async () => {
      const systemName = 'FLOWABLE';
      const configData = {
        id: 1,
        system_name: systemName,
        is_enabled: false,
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(configData);
      mockPrismaService.integrationConfig.update.mockResolvedValue({
        ...configData,
        is_enabled: true,
      });

      const result = await service.toggleIntegration(systemName, true, 'user123');

      expect(result.message).toContain('enabled');
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'ENABLE_INTEGRATION',
        }),
      );
    });

    it('should disable integration', async () => {
      const systemName = 'KEYCLOAK';
      const configData = {
        id: 2,
        system_name: systemName,
        is_enabled: true,
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(configData);
      mockPrismaService.integrationConfig.update.mockResolvedValue({
        ...configData,
        is_enabled: false,
      });

      const result = await service.toggleIntegration(systemName, false, 'user123');

      expect(result.message).toContain('disabled');
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'DISABLE_INTEGRATION',
        }),
      );
    });

    it('should throw NotFoundException if integration not found', async () => {
      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(null);

      await expect(service.toggleIntegration('NONEXISTENT', true, 'user123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('testIntegration', () => {
    it('should test integration successfully', async () => {
      const systemName = 'ALERT_TRIAGE';
      const configData = {
        id: 1,
        system_name: systemName,
        endpoint_url: 'https://api.example.com',
        is_enabled: true,
        api_key: null,
        api_secret: null,
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(configData);
      mockPrismaService.integrationConfig.update.mockResolvedValue({
        ...configData,
        test_status: 'SUCCESS',
      });

      const result = await service.testIntegration(systemName, 'user123');

      expect(result.test_status).toBe('SUCCESS');
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'SUCCESS',
        }),
      );
    });

    it('should throw NotFoundException if integration not found', async () => {
      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(null);

      await expect(service.testIntegration('NONEXISTENT', 'user123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if integration is disabled', async () => {
      mockPrismaService.integrationConfig.findUnique.mockResolvedValue({
        id: 1,
        system_name: 'FLOWABLE',
        is_enabled: false,
      });

      await expect(service.testIntegration('FLOWABLE', 'user123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle test failure', async () => {
      const systemName = 'API_PORTAL';
      const configData = {
        id: 2,
        system_name: systemName,
        endpoint_url: null, // This will cause test to fail
        is_enabled: true,
        api_key: null,
        api_secret: null,
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(configData);
      mockPrismaService.integrationConfig.update.mockResolvedValue({
        ...configData,
        test_status: 'FAILED',
      });

      const result = await service.testIntegration(systemName, 'user123');

      expect(result.test_status).toBe('FAILED');
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });

    it('should handle exception during testing', async () => {
      const configData = {
        id: 1,
        system_name: 'FLOWABLE',
        is_enabled: true,
        api_key: null,
        api_secret: null,
      };

      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(configData);
      mockPrismaService.integrationConfig.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.testIntegration('FLOWABLE', 'user123')).rejects.toThrow();
    });
  });

  describe('verify2FAAndApplyChange', () => {
    it('should verify 2FA and apply role change', async () => {
      const changeLog = {
        id: 1,
        config_key: 'role:TEST_ROLE',
        new_value: ['READ', 'WRITE'],
        change_status: 'PENDING',
        changed_by: 'user123',
        change_reason: 'Test',
      };

      mockPrismaService.configurationChangeLog.findUnique.mockResolvedValue(changeLog);
      mockPrismaService.configurationChangeLog.update.mockResolvedValue({
        ...changeLog,
        change_status: 'APPROVED',
      });
      mockPrismaService.rolePermission.upsert.mockResolvedValue({
        id: 1,
        role_name: 'TEST_ROLE',
        permissions: ['READ', 'WRITE'],
      });

      const result = await service.verify2FAAndApplyChange(1, '123456', 'user123');

      expect(result.status).toBe('APPLIED');
      expect(mockAuditLogService.logAction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if change log not found', async () => {
      mockPrismaService.configurationChangeLog.findUnique.mockResolvedValue(null);

      await expect(service.verify2FAAndApplyChange(999, '123456', 'user123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if change is not pending', async () => {
      mockPrismaService.configurationChangeLog.findUnique.mockResolvedValue({
        id: 1,
        change_status: 'APPLIED',
        changed_by: 'user123',
      });

      await expect(service.verify2FAAndApplyChange(1, '123456', 'user123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if user is not the change creator', async () => {
      mockPrismaService.configurationChangeLog.findUnique.mockResolvedValue({
        id: 1,
        change_status: 'PENDING',
        changed_by: 'other-user',
      });

      await expect(service.verify2FAAndApplyChange(1, '123456', 'user123')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for invalid 2FA code', async () => {
      mockPrismaService.configurationChangeLog.findUnique.mockResolvedValue({
        id: 1,
        change_status: 'PENDING',
        changed_by: 'user123',
      });

      await expect(service.verify2FAAndApplyChange(1, 'abc', 'user123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getConfigurationChangeLogs', () => {
    it('should return paginated change logs', async () => {
      const logs = [
        { id: 1, config_key: 'role:TEST', change_type: 'CREATE' },
        { id: 2, config_key: 'integration:FLOWABLE', change_type: 'UPDATE' },
      ];

      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue(logs);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(2);

      const result = await service.getConfigurationChangeLogs({ page: 1, limit: 50 });

      expect(result.logs).toEqual(logs);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue([]);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(0);

      await service.getConfigurationChangeLogs({ startDate, endDate });

      expect(mockPrismaService.configurationChangeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });

    it('should filter by changed by user', async () => {
      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue([]);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(0);

      await service.getConfigurationChangeLogs({ changedBy: 'user123' });

      expect(mockPrismaService.configurationChangeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            changed_by: 'user123',
          }),
        }),
      );
    });

    it('should filter by config type', async () => {
      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue([]);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(0);

      await service.getConfigurationChangeLogs({ configType: 'role' });

      expect(mockPrismaService.configurationChangeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            config_key: { contains: 'role' },
          }),
        }),
      );
    });

    it('should handle custom pagination', async () => {
      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue([]);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(150);

      const result = await service.getConfigurationChangeLogs({ page: 2, limit: 25 });

      expect(result.pagination.totalPages).toBe(6);
      expect(mockPrismaService.configurationChangeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        }),
      );
    });
  });

  describe('exportConfigurationLogs', () => {
    it('should export logs as JSON', async () => {
      const logs = [
        {
          id: 1,
          config_key: 'role:TEST',
          change_type: 'CREATE',
          changed_by: 'user1',
          change_status: 'APPLIED',
          created_at: new Date('2024-01-01'),
          approved_by: null,
          approval_date: null,
        },
      ];

      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue(logs);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(1);

      const result = await service.exportConfigurationLogs('json');

      expect(result).toEqual(logs);
    });

    it('should export logs as CSV', async () => {
      const logs = [
        {
          id: 1,
          config_key: 'role:TEST',
          change_type: 'CREATE',
          changed_by: 'user1',
          change_status: 'APPLIED',
          created_at: new Date('2024-01-01'),
          approved_by: 'admin',
          approval_date: new Date('2024-01-02'),
        },
      ];

      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue(logs);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(1);

      const result = await service.exportConfigurationLogs('csv');

      expect(result).toContain('ID,Config Key,Change Type');
      expect(result).toContain('role:TEST');
      expect(result).toContain('CREATE');
    });

    it('should return message when no logs found for CSV export', async () => {
      mockPrismaService.configurationChangeLog.findMany.mockResolvedValue([]);
      mockPrismaService.configurationChangeLog.count.mockResolvedValue(0);

      const result = await service.exportConfigurationLogs('csv');

      expect(result).toBe('No configuration changes found');
    });
  });

  describe('getSystemConfiguration', () => {
    it('should return system configuration', async () => {
      const configData = {
        id: 1,
        config_key: 'max_upload_size',
        config_value: 10485760,
        description: 'Maximum file upload size',
      };

      mockPrismaService.systemConfiguration.findUnique.mockResolvedValue(configData);

      const result = await service.getSystemConfiguration('max_upload_size');

      expect(result).toEqual(configData);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.systemConfiguration.findUnique.mockResolvedValue(null);

      await expect(service.getSystemConfiguration('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSystemConfiguration', () => {
    it('should create new system configuration', async () => {
      const configKey = 'new_config';
      const configValue = { enabled: true };

      mockPrismaService.systemConfiguration.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 1 });
      mockPrismaService.systemConfiguration.upsert.mockResolvedValue({
        id: 1,
        config_key: configKey,
        config_value: configValue,
        config_type: 'system_settings',
      });

      const result = await service.updateSystemConfiguration(
        configKey,
        configValue,
        'user123',
        'New config',
      );

      expect(result.config_key).toBe(configKey);
      expect(mockAuditLogService.logAction).toHaveBeenCalled();
    });

    it('should update existing system configuration', async () => {
      const configKey = 'existing_config';
      const oldValue = { enabled: false };
      const newValue = { enabled: true };

      mockPrismaService.systemConfiguration.findUnique.mockResolvedValue({
        id: 1,
        config_key: configKey,
        config_value: oldValue,
      });
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 2 });
      mockPrismaService.systemConfiguration.upsert.mockResolvedValue({
        id: 1,
        config_key: configKey,
        config_value: newValue,
        version: 2,
      });

      const result = await service.updateSystemConfiguration(
        configKey,
        newValue,
        'user123',
        'Updated config',
      );

      expect(result.config_value).toEqual(newValue);
    });
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt text correctly', async () => {
      const systemName = 'ALERT_TRIAGE';
      const config = {
        endpoint_url: 'https://api.example.com',
        api_key: 'my-secret-key-12345',
        api_secret: 'super-secret-value',
      };

      // Configure integration (which encrypts)
      mockPrismaService.integrationConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.configurationChangeLog.create.mockResolvedValue({ id: 1 });

      let encryptedApiKey: string | undefined;
      let encryptedApiSecret: string | undefined;

      mockPrismaService.integrationConfig.upsert.mockImplementation(async (params) => {
        encryptedApiKey = (params.update?.api_key || params.create?.api_key) as string;
        encryptedApiSecret = (params.update?.api_secret || params.create?.api_secret) as string;
        return {
          id: 1,
          system_name: systemName,
          endpoint_url: config.endpoint_url,
          api_key: encryptedApiKey,
          api_secret: encryptedApiSecret,
          is_enabled: true,
        };
      });

      await service.configureIntegration(systemName, config, 'user123');

      expect(encryptedApiKey).toBeDefined();
      expect(encryptedApiKey).not.toBe(config.api_key);
      expect(encryptedApiKey).toContain(':'); // encrypted format has iv:data

      // Test decryption through testIntegration
      mockPrismaService.integrationConfig.findUnique.mockResolvedValue({
        id: 1,
        system_name: systemName,
        endpoint_url: config.endpoint_url,
        api_key: encryptedApiKey,
        api_secret: encryptedApiSecret,
        is_enabled: true,
      });
      mockPrismaService.integrationConfig.update.mockResolvedValue({
        id: 1,
        test_status: 'SUCCESS',
      });

      const testResult = await service.testIntegration(systemName, 'user123');
      expect(testResult).toBeDefined(); // If decryption failed, it would throw
    });

    it('should handle encryption errors gracefully', () => {
      jest.spyOn(crypto, 'randomBytes').mockImplementation(() => {
        throw new Error('Crypto error');
      });

      expect(() => {
        // Access private method through any to test error handling
        (service as any).encrypt('test-data');
      }).toThrow('Failed to encrypt sensitive data');

      jest.restoreAllMocks();
    });

    it('should handle decryption errors for invalid format', () => {
      expect(() => {
        (service as any).decrypt('invalid-format-no-colon');
      }).toThrow('Failed to decrypt sensitive data');
    });

    it('should handle decryption errors for malformed data', () => {
      expect(() => {
        (service as any).decrypt('aaaa:bbbb');
      }).toThrow('Failed to decrypt sensitive data');
    });
  });

  describe('integration test helpers', () => {
    it('should test FLOWABLE connection with valid endpoint', async () => {
      const result = await (service as any).testFlowableConnection({
        endpoint_url: 'https://flowable.example.com',
      });

      expect(result).toBe(true);
    });

    it('should test FLOWABLE connection without endpoint', async () => {
      const result = await (service as any).testFlowableConnection({
        endpoint_url: null,
      });

      expect(result).toBe(false);
    });

    it('should test KEYCLOAK connection with valid endpoint', async () => {
      const result = await (service as any).testKeycloakConnection({
        endpoint_url: 'https://keycloak.example.com',
      });

      expect(result).toBe(true);
    });

    it('should handle unknown system types in performIntegrationTest', async () => {
      const result = await (service as any).performIntegrationTest('UNKNOWN_SYSTEM', {});

      expect(result).toBe(true);
      expect(loggerService.warn).toHaveBeenCalledWith('No test implementation for UNKNOWN_SYSTEM');
    });
  });
});
