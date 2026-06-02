import { Controller, Get, Query, Req, BadRequestException, UseGuards, Param } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RequireInvestigatorOrSupervisorRoleOrComplianceRole } from '../../decorators/auth.decorator';
import { AuthenticatedRequest } from '../../utils/types/auth.types';
import { AlertStatisticsService } from './alert.statistics.service';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { AlertResponseDto } from './dto';
import { AlertService } from './alert.service';
import { AlertDetailsResponseDTO } from './dto/AlertDetailsResponse.dto';
import { AlertActionHistoryDTO } from './dto/AlertActionHistory.dto';
import { Priority, Prisma } from '@prisma/client-cms';
import { transactionDataResponseDTO } from './dto/transactionHistory.dto';

@Controller('api/v1/alert')
@UseGuards(TazamaAuthGuard)
export class AlertController {
  constructor(
    private readonly alertStatisticsService: AlertStatisticsService,
    private readonly alertService: AlertService,
  ) {}

  @Get()
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
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
    name: 'nullAlertType',
    required: false,
    type: 'string',
    description: 'Filter for alerts with no alert type (pass "true")',
    example: 'true',
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
  @ApiResponse({
    status: 200,
    description: 'Alerts retrieved successfully',
    type: AlertResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserAlerts(
    @Req() req: AuthenticatedRequest,
    @Query('reportStatus') reportStatus?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('sortBy') sortBy = 'created_at',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('alertType') alertType?: string,
    @Query('nullAlertType') nullAlertType?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ): Promise<{
    data: Array<{
      alert_id: number;
      txtp: string;
      priority: Priority | null;
      confidence_per: number;
      source: string | null;
      alert_type: string | null;
      created_at: Date;
      transaction: Prisma.JsonValue;
      alert_data: Prisma.JsonValue;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const { tenantId } = req.user.token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return await this.alertStatisticsService.getAlertsForUser({
      tenantId,
      priority,
      type,
      alertType,
      nullAlertType: nullAlertType === 'true',
      search,
      source,
      reportStatus,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      sortOrder,
    });
  }

  @Get(':alertId/transaction-data')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Get transactional data',
    description: 'Retrieve all transactional data of the user',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({
    name: 'alertId',
    required: true,
    type: 'number',
    description: 'alert Id',
    example: '1',
  })
  async getAlertTransactionalData(
    @Req() req: AuthenticatedRequest,
    @Param('alertId') alertId: number,
  ): Promise<{ transactionData: transactionDataResponseDTO }> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing clientId');
    return await this.alertService.getAlertTransactionalData(alertId, tenantId);
  }

  @Get(':alertId')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get alert details',
    description: 'Retrieve detailed information about a specific alert',
  })
  @ApiParam({
    name: 'alertId',
    type: 'number',
    description: 'alert Id',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert details retrieved successfully',
    type: AlertDetailsResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertDetails(
    @Param('alertId') alertId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    priority: Priority | null;
    source: string | null;
    created_at: Date;
    alert_id: number | null;
    priority_score: number | null;
    alert_type: string | null;
    prediction_outcome: string | null;
    txtp: string;
    message: string;
    alert_data: Prisma.JsonValue;
    transaction: Prisma.JsonValue;
    network_map: Prisma.JsonValue;
    confidence_per: number;
    case_id: number | null;
  } | null> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return await this.alertService.getAlertDetails(alertId, tenantId, userId);
  }

  @Get(':alertId/action-history')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  @ApiOperation({
    summary: 'Get alert action history',
    description: 'Retrieve all actions taken on a specific alert',
  })
  @ApiParam({
    name: 'alertId',
    type: 'number',
    description: 'ID of the alert',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Action history retrieved successfully',
    type: [AlertActionHistoryDTO],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertActionHistory(
    @Param('alertId') alertId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    alertId: number;
    tenantId: string;
    userId: string;
    history: Array<{
      event_log_id: number;
      user_id: string;
      operation: string;
      entity_name: string;
      action_performed: string;
      outcome: string;
      performed_at: Date;
    }>;
  }> {
    const userId = req.user.token.clientId;
    const { tenantId } = req.user.token;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return await this.alertService.getAlertActionHistory(alertId, tenantId, userId);
  }
}
