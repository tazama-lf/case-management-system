import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject, IsString } from 'class-validator';

export class HealthCheckResponseDTO {
    @ApiProperty({
        description: 'Health status indicator',
        example: 'ok',
        type: 'string',
    })
    status: string;
}

export class AlertTriageResponseDTO {
    @ApiProperty({
        description: 'Alert unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000',
        format: 'uuid',
    })
    alert_id: string;

    @ApiProperty({
        description: 'Alert status after triage',
        example: 'TRIAGED',
        type: 'string',
    })
    status: string;

    @ApiProperty({
        description: 'Alert priority level',
        example: 'URGENT',
        type: 'string',
    })
    priority: string;

    @ApiProperty({
        description: 'Confidence percentage (0-100)',
        example: 85.5,
        type: 'number',
        minimum: 0,
    })
    confidence_per: number;

    @ApiProperty({
        description: 'Timestamp when alert was last updated',
        example: '2024-12-03T10:30:00Z',
        format: 'date-time',
    })
    updated_at: string;
}

export class AlertActionHistoryDTO {
    @ApiProperty({
        description: 'Action unique identifier',
        example: '456e7890-e89b-12d3-a456-426614174001',
        format: 'uuid',
    })
    action_id: string;

    @ApiProperty({
        description: 'Type of action performed',
        example: 'MANUAL_TRIAGE',
        type: 'string',
    })
    action_type: string;

    @ApiProperty({
        description: 'User who performed the action',
        example: '789e0123-e89b-12d3-a456-426614174002',
        format: 'uuid',
    })
    user_id: string;

    @ApiProperty({
        description: 'Action note or comment',
        example: 'Updated priority based on additional investigation',
        type: 'string',
    })
    note: string;

    @ApiProperty({
        description: 'Timestamp when action was performed',
        example: '2024-12-03T10:30:00Z',
        format: 'date-time',
    })
    created_at: string;
}

export class AlertDetailsResponseDTO {
    @ApiProperty({
        description: 'Alert unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000',
        format: 'uuid',
    })
    @IsString()
    alert_id: string;

    @ApiProperty({
        description: 'Alert message or description',
        example: 'Suspicious transaction detected',
    })
    @IsString()
    message: string;

    @ApiProperty({
        description: 'Alert priority level',
        example: 'URGENT',
    })
    @IsString()
    priority: string;

    @ApiProperty({
        description: 'Type of alert (FRAUD, AML, etc.)',
        example: 'FRAUD'
    })
    @IsString()
    alert_type: string;

    @ApiProperty({
        description: 'Confidence percentage (0-100)',
        example: 85.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    confidence_per: number;

    @ApiProperty({
        description: 'Associated case ID if case was created',
        example: '987e6543-e89b-12d3-a456-426614174003',
        format: 'uuid',
        nullable: true,
        required: false,
    })
    @IsString()
    case_id?: string;

    @ApiProperty({
        description: 'Alert-specific data and metadata',
        example: {
            ruleId: 'RULE_001',
            threshold: 1000,
            actualAmount: 1500,
        },
    })
    @IsObject()
    alert_data: Record<string, any>;

    @ApiProperty({
        description: 'Transaction data that triggered the alert',
        example: {
            transactionId: 'TXN_123456',
            amount: 1500,
            currency: 'USD',
            fromAccount: 'ACC_001',
            toAccount: 'ACC_002',
        },
    })
    @IsObject()
    transaction_data: Record<string, any>;

    @ApiProperty({ description: 'Network analysis and mapping data' })
    network_map: Record<string, any>;

    @ApiProperty({
        description: 'Timestamp when alert was created',
        example: '2024-12-03T09:00:00Z',
        format: 'date-time',
    })
    created_at: string;

    @ApiProperty({
        description: 'Timestamp when alert was last updated',
        example: '2024-12-03T10:30:00Z',
        format: 'date-time',
    })
    updated_at: string;
}
