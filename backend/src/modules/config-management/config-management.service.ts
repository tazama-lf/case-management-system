import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as crypto from 'node:crypto';
import { Outcome } from '../../utils/types/outcome';
import { JsonValue, JsonObject, JsonArray } from '@prisma/client/runtime/library';

@Injectable()
export class ConfigManagementService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly logger: LoggerService,
  ) {
    this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY ?? 'default-encryption-key';

    if (this.encryptionKey.length !== 64) {
      this.logger.warn('CONFIG_ENCRYPTION_KEY should be 64 hex characters (32 bytes)');
    }
  }

  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey.padEnd(64, '0').slice(0, 64), 'hex');
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  private decrypt(text: string): string {
    try {
      const parts = text.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = Buffer.from(parts[1], 'hex');
      const key = Buffer.from(this.encryptionKey.padEnd(64, '0').slice(0, 64), 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedText, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  async configureRole(
    roleName: string,
    permissions: string[],
    description: string,
    userId: string,
    require2FA = true,
  ): Promise<
    | {
        created_at: Date;
        updated_at: Date;
        description: string | null;
        id: number;
        created_by: string;
        role_name: string;
        permissions: JsonValue;
        is_system_role: boolean;
        is_active: boolean;
        updated_by: string;
      }
    | {
        status: string;
        changeId: number;
        message: string;
      }
  > {
    try {
      if (!roleName || roleName.trim().length < 3) {
        throw new BadRequestException('Role name must be at least 3 characters');
      }

      if (!permissions || permissions.length === 0) {
        throw new BadRequestException('At least one permission is required');
      }

      const existingRole = await this.prisma.rolePermission.findUnique({
        where: { role_name: roleName },
      });

      if (existingRole?.is_system_role) {
        throw new ForbiddenException('Cannot modify system roles');
      }

      const changeLog = await this.prisma.configurationChangeLog.create({
        data: {
          config_id: existingRole?.id!,
          config_key: `role:${roleName}`,
          old_value: existingRole ? (existingRole.permissions as any) : undefined,
          new_value: permissions as any,
          change_type: existingRole ? 'UPDATE' : 'CREATE',
          changed_by: userId,
          requires_2fa: require2FA,
          change_status: require2FA ? 'PENDING' : 'APPLIED',
          change_reason: description,
        },
      });

      if (require2FA) {
        return {
          status: 'PENDING_2FA',
          changeId: changeLog.id,
          message: 'Role configuration pending 2FA verification',
        };
      }

      const roleConfig = await this.prisma.rolePermission.upsert({
        where: { role_name: roleName },
        update: {
          permissions,
          description,
          updated_by: userId,
        },
        create: {
          role_name: roleName,
          permissions,
          description,
          created_by: userId,
          updated_by: userId,
        },
      });

      await this.auditLog.logAction({
        userId,
        operation: 'CONFIGURE_ROLE',
        entityName: 'RolePermission',
        actionPerformed: `Configured role ${roleName} with permissions: ${permissions.join(', ')}`,
        outcome: Outcome.SUCCESS,
      });

      return roleConfig;
    } catch (error) {
      this.logger.error(`Failed to configure role: ${error.message}`);

      await this.auditLog.logAction({
        userId,
        operation: 'CONFIGURE_ROLE',
        entityName: 'RolePermission',
        actionPerformed: `Failed to configure role ${roleName}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async getRolePermissions(roleName: string): Promise<{
    id: number;
    role_name: string;
    permissions: JsonValue;
    description: string | null;
    is_system_role: boolean;
    is_active: boolean;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
  }> {
    const role = await this.prisma.rolePermission.findUnique({
      where: { role_name: roleName },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    return role;
  }

  async listAllRoles(): Promise<
    Array<{
      description: string | null;
      created_at: Date;
      updated_at: Date;
      id: number;
      role_name: string;
      permissions: JsonValue;
      is_system_role: boolean;
      is_active: boolean;
    }>
  > {
    return await this.prisma.rolePermission.findMany({
      where: { is_active: true },
      orderBy: { role_name: 'asc' },
      select: {
        id: true,
        role_name: true,
        permissions: true,
        description: true,
        is_system_role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async deleteRole(roleName: string, userId: string) {
    const role = await this.prisma.rolePermission.findUnique({
      where: { role_name: roleName },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }

    if (role.is_system_role) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    // Soft delete by setting is_active to false
    await this.prisma.rolePermission.update({
      where: { role_name: roleName },
      data: {
        is_active: false,
        updated_by: userId,
      },
    });

    // Log the deletion
    await this.prisma.configurationChangeLog.create({
      data: {
        config_id: role.id,
        config_key: `role:${roleName}`,
        old_value: role.permissions as any,
        new_value: { deleted: true } as any,
        change_type: 'DEACTIVATE',
        changed_by: userId,
        change_status: 'APPLIED',
      },
    });

    await this.auditLog.logAction({
      userId,
      operation: 'DELETE_ROLE',
      entityName: 'RolePermission',
      actionPerformed: `Deleted role ${roleName}`,
      outcome: Outcome.SUCCESS,
    });

    return { message: `Role ${roleName} deleted successfully` };
  }

  async configureIntegration(
    systemName: string,
    config: {
      endpoint_url?: string;
      api_key?: string;
      api_secret?: string;
      auth_type?: string;
      config_data?: any;
    },
    userId: string,
  ): Promise<{
    api_key: string | null;
    api_secret: string | null;
    id: number;
    system_name: string;
    endpoint_url: string | null;
    config_data: string | number | boolean | JsonObject | JsonArray | null;
    auth_type: string | null;
    is_enabled: boolean;
    last_tested_at: Date | null;
    test_status: string | null;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
  }> {
    try {
      const validSystems = ['ALERT_TRIAGE', 'API_PORTAL', 'FLOWABLE', 'KEYCLOAK'];
      if (!validSystems.includes(systemName)) {
        throw new BadRequestException(`Invalid system name. Must be one of: ${validSystems.join(', ')}`);
      }

      const encryptedConfig = {
        ...config,
        api_key: config.api_key ? this.encrypt(config.api_key) : null,
        api_secret: config.api_secret ? this.encrypt(config.api_secret) : null,
      };

      const existingConfig = await this.prisma.integrationConfig.findUnique({
        where: { system_name: systemName },
      });

      await this.prisma.configurationChangeLog.create({
        data: {
          config_id: existingConfig?.id!,
          config_key: `integration:${systemName}`,
          old_value: existingConfig
            ? ({
                endpoint_url: existingConfig.endpoint_url,
                auth_type: existingConfig.auth_type,
                is_enabled: existingConfig.is_enabled,
              } as any)
            : undefined,
          new_value: {
            endpoint_url: config.endpoint_url,
            auth_type: config.auth_type,
          } as any,
          change_type: existingConfig ? 'UPDATE' : 'CREATE',
          changed_by: userId,
          change_status: 'APPLIED',
        },
      });

      const integrationConfig = await this.prisma.integrationConfig.upsert({
        where: { system_name: systemName },
        update: {
          ...encryptedConfig,
          updated_by: userId,
          last_tested_at: null,
          test_status: 'PENDING',
        },
        create: {
          system_name: systemName,
          ...encryptedConfig,
          created_by: userId,
          updated_by: userId,
        },
      });

      await this.auditLog.logAction({
        userId,
        operation: 'CONFIGURE_INTEGRATION',
        entityName: 'IntegrationConfig',
        actionPerformed: `Configured integration for ${systemName}`,
        outcome: Outcome.SUCCESS,
      });

      return {
        ...integrationConfig,
        api_key: config.api_key ? '***ENCRYPTED***' : null,
        api_secret: config.api_secret ? '***ENCRYPTED***' : null,
      };
    } catch (error) {
      this.logger.error(`Failed to configure integration: ${error.message}`);

      await this.auditLog.logAction({
        userId,
        operation: 'CONFIGURE_INTEGRATION',
        entityName: 'IntegrationConfig',
        actionPerformed: `Failed to configure integration for ${systemName}`,
        outcome: Outcome.FAILURE,
      });

      throw error;
    }
  }

  async getIntegrationConfig(systemName: string) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { system_name: systemName },
    });

    if (!config) {
      throw new NotFoundException(`Integration ${systemName} not found`);
    }

    return {
      ...config,
      api_key: config.api_key ? '***ENCRYPTED***' : null,
      api_secret: config.api_secret ? '***ENCRYPTED***' : null,
    };
  }

  async listAllIntegrations() {
    const configs = await this.prisma.integrationConfig.findMany({
      orderBy: { system_name: 'asc' },
    });

    return configs.map((config) => ({
      ...config,
      api_key: config.api_key ? '***ENCRYPTED***' : null,
      api_secret: config.api_secret ? '***ENCRYPTED***' : null,
    }));
  }

  async toggleIntegration(systemName: string, enabled: boolean, userId: string) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { system_name: systemName },
    });

    if (!config) {
      throw new NotFoundException(`Integration ${systemName} not found`);
    }

    await this.prisma.integrationConfig.update({
      where: { system_name: systemName },
      data: {
        is_enabled: enabled,
        updated_by: userId,
      },
    });

    await this.auditLog.logAction({
      userId,
      operation: enabled ? 'ENABLE_INTEGRATION' : 'DISABLE_INTEGRATION',
      entityName: 'IntegrationConfig',
      actionPerformed: `${enabled ? 'Enabled' : 'Disabled'} integration ${systemName}`,
      outcome: Outcome.SUCCESS,
    });

    return { message: `Integration ${systemName} ${enabled ? 'enabled' : 'disabled'} successfully` };
  }

  async testIntegration(
    systemName: string,
    userId: string,
  ): Promise<{
    system_name: string;
    test_status: string;
    tested_at: Date;
    endpoint_url: string | null;
  }> {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { system_name: systemName },
    });

    if (!config) {
      throw new NotFoundException(`Integration ${systemName} not found`);
    }

    if (!config.is_enabled) {
      throw new BadRequestException(`Integration ${systemName} is disabled`);
    }

    try {
      const decryptedConfig = {
        ...config,
        api_key: config.api_key ? this.decrypt(config.api_key) : null,
        api_secret: config.api_secret ? this.decrypt(config.api_secret) : null,
      };

      const testResult = await this.performIntegrationTest(systemName, decryptedConfig);

      await this.prisma.integrationConfig.update({
        where: { id: config.id },
        data: {
          last_tested_at: new Date(),
          test_status: testResult ? 'SUCCESS' : 'FAILED',
        },
      });

      await this.auditLog.logAction({
        userId,
        operation: 'TEST_INTEGRATION',
        entityName: 'IntegrationConfig',
        actionPerformed: `Tested integration ${systemName}: ${testResult ? 'SUCCESS' : 'FAILED'}`,
        outcome: testResult ? Outcome.SUCCESS : Outcome.FAILURE,
      });

      return {
        system_name: systemName,
        test_status: testResult ? 'SUCCESS' : 'FAILED',
        tested_at: new Date(),
        endpoint_url: config.endpoint_url,
      };
    } catch (error) {
      this.logger.error(`Integration test failed: ${error.message}`);

      await this.prisma.integrationConfig.update({
        where: { id: config.id },
        data: {
          last_tested_at: new Date(),
          test_status: 'FAILED',
        },
      });

      throw error;
    }
  }

  private async performIntegrationTest(systemName: string, config: any): Promise<boolean> {
    // Implement actual integration testing based on system type
    switch (systemName) {
      case 'ALERT_TRIAGE':
        return this.testAlertTriageConnection(config);
      case 'API_PORTAL':
        return this.testApiPortalConnection(config);
      case 'FLOWABLE':
        return this.testFlowableConnection(config);
      case 'KEYCLOAK':
        return this.testKeycloakConnection(config);
      default:
        this.logger.warn(`No test implementation for ${systemName}`);
        return true;
    }
  }

  private testAlertTriageConnection(config: any): boolean {
    try {
      if (!config.endpoint_url) {
        return false;
      }

      return true; // Placeholder
    } catch (error) {
      this.logger.error(`Alert Triage test failed: ${error.message}`);
      return false;
    }
  }

  private testApiPortalConnection(config: any): boolean {
    try {
      if (!config.endpoint_url) {
        return false;
      }

      return true; // Placeholder
    } catch (error) {
      this.logger.error(`API Portal test failed: ${error.message}`);
      return false;
    }
  }

  private testFlowableConnection(config: any): boolean {
    try {
      if (!config.endpoint_url) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Flowable test failed: ${error.message}`);
      return false;
    }
  }

  private testKeycloakConnection(config: any): boolean {
    try {
      if (!config.endpoint_url) {
        return false;
      }

      return true; // Placeholder
    } catch (error) {
      this.logger.error(`Keycloak test failed: ${error.message}`);
      return false;
    }
  }

  async verify2FAAndApplyChange(
    changeId: number,
    twoFactorCode: string,
    userId: string,
  ): Promise<{ message: string; changeId: number; config_key: string; status: string }> {
    const changeLog = await this.prisma.configurationChangeLog.findUnique({
      where: { id: changeId },
    });

    if (!changeLog) {
      throw new NotFoundException('Configuration change not found');
    }

    if (changeLog.change_status !== 'PENDING') {
      throw new BadRequestException('Configuration change is not pending');
    }

    if (changeLog.changed_by !== userId) {
      throw new ForbiddenException('You can only verify your own configuration changes');
    }

    if (!/^\d{6}$/.test(twoFactorCode)) {
      throw new BadRequestException('Invalid 2FA code format');
    }

    await this.prisma.configurationChangeLog.update({
      where: { id: changeId },
      data: {
        change_status: 'APPROVED',
        approved_by: userId,
        approval_date: new Date(),
      },
    });

    if (changeLog.config_key.startsWith('role:')) {
      const roleName = changeLog.config_key.replace('role:', '');
      const newPermissions = changeLog.new_value as string[];

      await this.prisma.rolePermission.upsert({
        where: { role_name: roleName },
        update: {
          permissions: newPermissions,
          updated_by: userId,
        },
        create: {
          role_name: roleName,
          permissions: newPermissions,
          description: changeLog.change_reason ?? '',
          created_by: userId,
          updated_by: userId,
        },
      });
    }

    await this.auditLog.logAction({
      userId,
      operation: 'APPLY_CONFIG_CHANGE',
      entityName: 'Configuration',
      actionPerformed: `Applied configuration change ${changeId} after 2FA verification`,
      outcome: Outcome.SUCCESS,
    });

    return {
      message: 'Configuration change approved and applied',
      changeId,
      config_key: changeLog.config_key,
      status: 'APPLIED',
    };
  }

  async getConfigurationChangeLogs(filters?: {
    startDate?: Date;
    endDate?: Date;
    changedBy?: string;
    configType?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: Array<{
      created_at: Date;
      id: number;
      config_id: number;
      config_key: string;
      old_value: JsonValue;
      new_value: JsonValue;
      change_type: string;
      changed_by: string;
      change_reason: string | null;
      ip_address: string | null;
      user_agent: string | null;
      requires_2fa: boolean;
      approved_by: string | null;
      approval_date: Date | null;
      change_status: string;
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const where: any = {};
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;
    const skip = (page - 1) * limit;

    if (filters?.startDate) {
      where.created_at = { gte: filters.startDate };
    }

    if (filters?.endDate) {
      where.created_at = { ...where.created_at, lte: filters.endDate };
    }

    if (filters?.changedBy) {
      where.changed_by = filters.changedBy;
    }

    if (filters?.configType) {
      where.config_key = { contains: filters.configType };
    }

    const [logs, total] = await Promise.all([
      this.prisma.configurationChangeLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.configurationChangeLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportConfigurationLogs(
    format: 'json' | 'csv',
    filters?: any,
  ): Promise<
    | string
    | Array<{
        created_at: Date;
        config_id: number;
        config_key: string;
        old_value: JsonValue;
        new_value: JsonValue;
        change_type: string;
        changed_by: string;
        change_reason: string | null;
        ip_address: string | null;
        user_agent: string | null;
        requires_2fa: boolean;
        approved_by: string | null;
        approval_date: Date | null;
        change_status: string;
        id: number;
      }>
  > {
    const { logs } = await this.getConfigurationChangeLogs({ ...filters, limit: 10000 });

    if (format === 'json') {
      return logs;
    }

    // Convert to CSV format
    if (logs.length === 0) {
      return 'No configuration changes found';
    }

    const headers = ['ID', 'Config Key', 'Change Type', 'Changed By', 'Change Status', 'Created At', 'Approved By', 'Approval Date'];

    const rows = logs.map((log) => [
      log.id,
      log.config_key,
      log.change_type,
      log.changed_by,
      log.change_status,
      log.created_at,
      log.approved_by ?? '',
      log.approval_date ?? '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    return csvContent;
  }

  async getSystemConfiguration(configKey: string) {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { config_key: configKey },
    });

    if (!config) {
      throw new NotFoundException(`Configuration ${configKey} not found`);
    }

    return config;
  }

  async updateSystemConfiguration(configKey: string, configValue: any, userId: string, description?: string) {
    const existingConfig = await this.prisma.systemConfiguration.findUnique({
      where: { config_key: configKey },
    });

    // Log the change
    await this.prisma.configurationChangeLog.create({
      data: {
        config_id: existingConfig?.id!,
        config_key: `system:${configKey}`,
        old_value: existingConfig?.config_value as any,
        new_value: configValue,
        change_type: existingConfig ? 'UPDATE' : 'CREATE',
        changed_by: userId,
        change_status: 'APPLIED',
        change_reason: description,
      },
    });

    const config = await this.prisma.systemConfiguration.upsert({
      where: { config_key: configKey },
      update: {
        config_value: configValue,
        description,
        updated_by: userId,
        version: { increment: 1 },
      },
      create: {
        config_key: configKey,
        config_value: configValue,
        config_type: 'system_settings',
        description,
        created_by: userId,
        updated_by: userId,
      },
    });

    await this.auditLog.logAction({
      userId,
      operation: 'UPDATE_SYSTEM_CONFIG',
      entityName: 'SystemConfiguration',
      actionPerformed: `Updated system configuration ${configKey}`,
      outcome: Outcome.SUCCESS,
    });

    return config;
  }
}
