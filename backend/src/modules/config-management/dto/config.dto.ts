import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

// Role Configuration DTOs
export class ConfigureRoleDto {
    @ApiProperty({
        description: 'List of permissions for the role',
        example: ['view_cases', 'create_cases', 'close_cases'],
    })
    @IsString({ each: true })
    permissions: string[];

    @ApiProperty({
        description: 'Description of the role',
        example: 'Investigator role with case management permissions',
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        description: 'Whether to require 2FA for this configuration change',
    })
    @IsOptional()
    @IsBoolean()
    require2FA?: boolean;
}

export class RoleDto {
    @ApiProperty({
        description: 'Role ID',
        format: 'uuid',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'Role name',
        example: 'CMS_INVESTIGATOR',
    })
    @IsString()
    role_name: string;

    @ApiProperty({
        description: 'List of permissions',
        example: ['view_cases', 'create_cases'],
    })
    @IsString({ each: true })
    permissions: string[];

    @ApiProperty({
        description: 'Role description',
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Whether this is a system role',
    })
    @IsBoolean()
    is_system_role: boolean;

    @ApiProperty({
        description: 'Whether the role is active',
    })
    @IsBoolean()
    is_active: boolean;
}

// Integration Configuration DTOs
export class ConfigureIntegrationDto {
    @ApiProperty({
        description: 'Endpoint URL for the integration',
        example: 'https://alert-triage.example.com/api',
    })
    @IsString()
    @IsOptional()
    endpoint_url?: string;

    @ApiProperty({
        description: 'API key for authentication',
        example: 'your-api-key',
    })
    api_key?: string;

    @ApiProperty({
        description: 'API secret for authentication',
        example: 'your-api-secret',
    })
    @IsString()
    @IsOptional()
    api_secret?: string;

    @ApiProperty({
        description: 'Authentication type',
        enum: ['API_KEY', 'OAUTH2', 'BASIC', 'JWT'],
        example: 'API_KEY',
    })
    @IsString()
    @IsOptional()
    auth_type?: string;

    @ApiProperty({
        description: 'Additional configuration data',
    })
    @IsOptional()
    @IsString()
    config_data?: any;
}

export class IntegrationTestResultDto {
    @ApiProperty({
        description: 'Name of the system tested',
        example: 'ALERT_TRIAGE',
    })
    @IsString()
    system_name: string;

    @ApiProperty({
        description: 'Test result status',
        enum: ['SUCCESS', 'FAILED'],
        example: 'SUCCESS',
    })
    @IsString()
    test_status: string;

    @ApiProperty({
        description: 'When the test was performed',
        format: 'date-time',
    })
    @IsString()
    tested_at: string;
}

// 2FA Verification DTO
export class Verify2FADto {
    @ApiProperty({
        description: '2FA verification code',
        example: '123456',
    })
    @IsString()
    twoFactorCode: string;
}

// Audit Configuration DTOs
export class ConfigurationChangeLogDto {
    @ApiProperty({
        description: 'Change log ID',
    })
    id: number;

    @ApiProperty({
        description: 'Configuration key that was changed',
    })
    @IsString()
    config_key: string;

    @ApiProperty({
        description: 'Previous value',
    })
    old_value: any;

    @ApiProperty({
        description: 'New value',
    })
    new_value: any;

    @ApiProperty({
        description: 'Type of change',
    })
    @IsString()
    change_type: string;

    @ApiProperty({
        description: 'User who made the change',
    })
    @IsString()
    changed_by: string;

    @ApiProperty({
        description: 'Reason for the change',
    })
    @IsString()
    change_reason: string;

    @ApiProperty({
        description: 'Status of the change',
    })
    @IsString()
    change_status: string;

    @ApiProperty({
        description: 'When the change was created',
        format: 'date-time',
    })
    @IsString()
    created_at: string;
}

export class ConfigurationExportResponseDto {
    @ApiProperty({
        description: 'Exported data',
    })
    data: any;

    @ApiProperty({
        description: 'Response headers (for CSV exports)',
    })
    headers?: {
        'Content-Type': string;
        'Content-Disposition': string;
    };
}
