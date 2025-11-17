import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigManagementService } from './config-management.service';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { RequireAdminRole } from '../auth/auth.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('System Configuration')
@Controller('api/v1/config')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class ConfigManagementController {
  constructor(private readonly configService: ConfigManagementService) {}

  @Put('roles/:roleName')
  @RequireAdminRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Configure role permissions',
    description: 'Configure or update role permissions. Requires admin privileges and may require 2FA.',
  })
  @ApiParam({
    name: 'roleName',
    description: 'Name of the role to configure',
    example: 'CMS_INVESTIGATOR',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['permissions'],
      properties: {
        permissions: {
          type: 'array',
          items: { type: 'string' },
          example: ['view_cases', 'create_cases', 'close_cases'],
        },
        description: {
          type: 'string',
          example: 'Investigator role with case management permissions',
        },
        require2FA: {
          type: 'boolean',
          default: true,
          description: 'Whether to require 2FA for this configuration change',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Role configured successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot modify system roles or insufficient privileges',
  })
  async configureRole(
    @Param('roleName') roleName: string,
    @Body()
    body: {
      permissions: string[];
      description?: string;
      require2FA?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.configService.configureRole(roleName, body.permissions, body.description || '', userId, body.require2FA ?? true);
  }

  @Get('roles')
  @RequireAdminRole()
  @ApiOperation({
    summary: 'List all roles',
    description: 'Get a list of all configured roles and their permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          role_name: { type: 'string' },
          permissions: {
            type: 'array',
            items: { type: 'string' },
          },
          description: { type: 'string' },
          is_system_role: { type: 'boolean' },
          is_active: { type: 'boolean' },
        },
      },
    },
  })
  async listRoles() {
    return this.configService.listAllRoles();
  }

  @Get('roles/:roleName')
  @RequireAdminRole()
  @ApiOperation({
    summary: 'Get role permissions',
    description: 'Get permissions for a specific role',
  })
  @ApiParam({
    name: 'roleName',
    description: 'Name of the role',
    example: 'CMS_SUPERVISOR',
  })
  async getRolePermissions(@Param('roleName') roleName: string) {
    return this.configService.getRolePermissions(roleName);
  }

  @Put('integration/:systemName')
  @RequireAdminRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Configure external integration',
    description: 'Configure integration settings for external systems',
  })
  @ApiParam({
    name: 'systemName',
    description: 'Name of the external system',
    enum: ['ALERT_TRIAGE', 'API_PORTAL', 'FLOWABLE', 'KEYCLOAK'],
    example: 'ALERT_TRIAGE',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        endpoint_url: {
          type: 'string',
          example: 'https://alert-triage.example.com/api',
        },
        api_key: {
          type: 'string',
          example: 'your-api-key',
        },
        api_secret: {
          type: 'string',
          example: 'your-api-secret',
        },
        auth_type: {
          type: 'string',
          enum: ['API_KEY', 'OAUTH2', 'BASIC', 'JWT'],
          example: 'API_KEY',
        },
        config_data: {
          type: 'object',
          description: 'Additional configuration data',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Integration configured successfully',
  })
  async configureIntegration(@Param('systemName') systemName: string, @Body() config: any, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.configService.configureIntegration(systemName, config, userId);
  }

  @Post('integration/:systemName/test')
  @RequireAdminRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test integration connection',
    description: 'Test connectivity with an external system',
  })
  @ApiParam({
    name: 'systemName',
    description: 'Name of the external system to test',
    enum: ['ALERT_TRIAGE', 'API_PORTAL', 'FLOWABLE', 'KEYCLOAK'],
  })
  @ApiResponse({
    status: 200,
    description: 'Integration test completed',
    schema: {
      type: 'object',
      properties: {
        system_name: { type: 'string' },
        test_status: {
          type: 'string',
          enum: ['SUCCESS', 'FAILED'],
        },
        tested_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  async testIntegration(@Param('systemName') systemName: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.configService.testIntegration(systemName, userId);
  }

  @Post('verify-2fa/:changeId')
  @RequireAdminRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify 2FA for configuration change',
    description: 'Complete a pending configuration change by providing 2FA verification',
  })
  @ApiParam({
    name: 'changeId',
    description: 'ID of the pending configuration change',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['twoFactorCode'],
      properties: {
        twoFactorCode: {
          type: 'string',
          example: '123456',
          description: '2FA verification code',
        },
      },
    },
  })
  async verify2FA(@Param('changeId') changeId: string, @Body() body: { twoFactorCode: string }, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.configService.verify2FAAndApplyChange(changeId, body.twoFactorCode, userId);
  }

  @Get('audit/changes')
  @RequireAdminRole()
  @ApiOperation({
    summary: 'Get configuration change logs',
    description: 'Retrieve audit logs for all configuration changes',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    format: 'date-time',
    description: 'Start date for filtering logs',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    format: 'date-time',
    description: 'End date for filtering logs',
  })
  @ApiQuery({
    name: 'changedBy',
    required: false,
    type: 'string',
    description: 'Filter by user who made the change',
  })
  @ApiQuery({
    name: 'configType',
    required: false,
    type: 'string',
    enum: ['role', 'integration', 'system'],
    description: 'Filter by configuration type',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration change logs retrieved',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          config_key: { type: 'string' },
          old_value: { type: 'object' },
          new_value: { type: 'object' },
          change_type: { type: 'string' },
          changed_by: { type: 'string' },
          change_reason: { type: 'string' },
          change_status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getConfigurationChangeLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('changedBy') changedBy?: string,
    @Query('configType') configType?: string,
  ) {
    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      changedBy,
      configType,
    };

    return this.configService.getConfigurationChangeLogs(filters);
  }

  @Get('audit/export')
  @RequireAdminRole()
  @ApiOperation({
    summary: 'Export configuration logs',
    description: 'Export configuration change logs for compliance verification',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    default: 'json',
    description: 'Export format',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    format: 'date-time',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    format: 'date-time',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration logs exported successfully',
  })
  async exportConfigurationLogs(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const data = await this.configService.exportConfigurationLogs(format, filters);

    if (format === 'csv') {
      return {
        data,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=configuration-audit-log.csv',
        },
      };
    }

    return data;
  }
}
