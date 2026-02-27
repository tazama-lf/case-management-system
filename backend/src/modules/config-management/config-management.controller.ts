import { Controller, Get, Put, Post, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigManagementService } from './config-management.service';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { RequireAdminRole } from '../../decorators/auth.decorator';
import { AuthenticatedRequest } from '../../utils/types/auth.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  ConfigureRoleDto,
  RoleDto,
  ConfigureIntegrationDto,
  IntegrationTestResultDto,
  Verify2FADto,
  ConfigurationChangeLogDto,
} from './dto/config.dto';

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
  @ApiBody({ type: ConfigureRoleDto })
  @ApiResponse({
    status: 200,
    description: 'Role configured successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot modify system roles or insufficient privileges',
  })
  async configureRole(@Param('roleName') roleName: string, @Body() body: ConfigureRoleDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return await this.configService.configureRole(roleName, body.permissions, body.description ?? '', userId, body.require2FA ?? true);
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
    type: [RoleDto],
  })
  async listRoles() {
    return await this.configService.listAllRoles();
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
    return await this.configService.getRolePermissions(roleName);
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
  @ApiBody({ type: ConfigureIntegrationDto })
  @ApiResponse({
    status: 200,
    description: 'Integration configured successfully',
  })
  async configureIntegration(
    @Param('systemName') systemName: string,
    @Body() config: ConfigureIntegrationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return await this.configService.configureIntegration(systemName, config, userId);
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
    type: IntegrationTestResultDto,
  })
  async testIntegration(@Param('systemName') systemName: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return await this.configService.testIntegration(systemName, userId);
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
  @ApiBody({ type: Verify2FADto })
  async verify2FA(@Param('changeId') changeId: number, @Body() body: Verify2FADto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;

    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }

    return await this.configService.verify2FAAndApplyChange(changeId, body.twoFactorCode, userId);
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
    type: [ConfigurationChangeLogDto],
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

    return await this.configService.getConfigurationChangeLogs(filters);
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
