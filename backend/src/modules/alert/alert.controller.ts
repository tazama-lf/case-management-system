import { Controller, Get, Query, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { RequireInvestigatorOrSupervisorRole } from '../../decorators/auth.decorator';
import { AuthenticatedRequest } from '../../utils/types/auth.types';
import { AlertStatisticsService } from './alert.statistics.service';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { AlertResponseDto } from './dto';

@Controller('api/v1/alert')
@UseGuards(TazamaAuthGuard)
export class AlertController {
    constructor(private readonly alertStatisticsService: AlertStatisticsService) { }

    @Get()
    @RequireInvestigatorOrSupervisorRole()
    @ApiOperation({
        summary: 'Get all alerts for current user',
        description: 'Retrieve paginated list of alerts with optional filtering',
    })
    @ApiQuery({
        name: 'priority',
        required: false,
        type: 'string',
        description: 'Filter by priority',
        example: 'URGENT',
    })
    @ApiQuery({
        name: 'type',
        required: false,
        type: 'string',
        description: 'Filter by type',
    })
    @ApiQuery({
        name: 'alertType',
        required: false,
        type: 'string',
        description: 'Filter by alert type',
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: 'string',
        description: 'Search term',
    })
    @ApiQuery({
        name: 'source',
        required: false,
        type: 'string',
        description: 'Filter by source',
    })
    @ApiQuery({
        name: 'reportStatus',
        required: false,
        type: 'string',
        description: 'Filter by report status',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: 'number',
        description: 'Page number',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: 'number',
        description: 'Items per page',
        example: 10,
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        type: 'string',
        description: 'Field to sort by',
        example: 'created_at',
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        enum: ['asc', 'desc'],
        description: 'Sort order',
        example: 'desc',
    })
    @ApiQuery({
        name: 'timeRange',
        required: false,
        type: 'string',
        description: 'Predefined time range filter',
        example: 'today',
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        type: 'string',
        description: 'Start date for custom date range (YYYY-MM-DD)',
        example: '2025-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        type: 'string',
        description: 'End date for custom date range (YYYY-MM-DD)',
        example: '2025-01-31',
    })
    @ApiResponse({
        status: 200,
        description: 'Alerts retrieved successfully',
        type: AlertResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getUserAlerts(
        @Req() req: AuthenticatedRequest,
        @Query('priority') priority?: string,
        @Query('type') type?: string,
        @Query('alertType') alertType?: string,
        @Query('search') search?: string,
        @Query('source') source?: string,
        @Query('reportStatus') reportStatus?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('sortBy') sortBy = 'created_at',
        @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
        @Query('timeRange') timeRange?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const tenantId = req.user.token.tenantId;
        if (!tenantId) throw new BadRequestException('Missing tenantId');
        
        // Log received parameters for debugging
        console.log('🔍 AlertController - Received parameters:', {
            priority, type, alertType, search, source, reportStatus,
            page, limit, sortBy, sortOrder, timeRange, startDate, endDate
        });
        
        return this.alertStatisticsService.getAlertsForUser({
            tenantId,
            priority,
            type,
            alertType,
            search,
            source,
            reportStatus,
            page: Number(page),
            limit: Number(limit),
            sortBy,
            sortOrder,
            timeRange,
            startDate,
            endDate,
        });
    }
}
