import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Query, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { TriageService } from './triage.service';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireAlertTriageRole, RequireInvestigatorOrSupervisorRole } from 'src/auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';
import { ManualTriageDto } from './dto/manual-triage.dto';
import { AlertMessageDto } from 'src/nats/dto/AlertMessageDto.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import {CreateNaltAlertDto} from "./dto/create-nalt-alert.dto";

@ApiTags('Alert Triage')
@Controller('api/v1/triage/alerts')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('')
  @RequireAlertTriageRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a new alert',
    description: 'Submit a new alert for triage processing',
  })
  @ApiBody({ type: SubmitAlertDto })
  @ApiResponse({
    status: 201,
    description: 'Alert submitted successfully',
    schema: {
      type: 'object',
      properties: {
        alert_id: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
        priority: { type: 'string' },
        confidence_per: { type: 'number' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async submitAlert(@Body() dto: SubmitAlertDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    const alert = await this.triageService.handleNewAlert(dto, userId, tenantId, 'REST API');
    return alert;
  }

  @Get('test')
  @ApiOperation({
    summary: 'Health check',
    description: 'Test endpoint to verify triage service is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  getTest() {
    return { status: 'ok' };
  }

  @Patch(':alertId')
  @RequireAlertTriageRole()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform manual triage on an alert',
    description: 'Update alert status and priority through manual triage decision',
  })
  @ApiParam({
    name: 'alertId',
    type: 'string',
    description: 'UUID of the alert to triage',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: ManualTriageDto })
  @ApiResponse({
    status: 200,
    description: 'Alert triaged successfully',
    schema: {
      type: 'object',
      properties: {
        alert_id: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        priority: { type: 'string' },
        confidence_per: { type: 'number' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async manualTriage(@Param('alertId') alertId: string, @Body() dto: ManualTriageDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return this.triageService.handleManualTriage(alertId, dto, userId, tenantId);
  }

  @Get()
  @RequireAlertTriageRole()
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
  @ApiResponse({
    status: 200,
    description: 'Alerts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              alert_id: { type: 'string', format: 'uuid' },
              message: { type: 'string' },
              priority: { type: 'string' },
              alert_type: { type: 'string' },
              confidence_per: { type: 'number' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
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
  ) {
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    return this.triageService.getAlertsForUser({
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
    });
  }

  @Get(':alertId/action-history')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Get alert action history',
    description: 'Retrieve all actions taken on a specific alert',
  })
  @ApiParam({
    name: 'alertId',
    type: 'string',
    description: 'UUID of the alert',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Action history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action_id: { type: 'string', format: 'uuid' },
          action_type: { type: 'string' },
          user_id: { type: 'string', format: 'uuid' },
          note: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertActionHistory(@Param('alertId') alertId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return this.triageService.getAlertActionHistory(alertId, tenantId, userId);
  }

  @Get(':alertId')
  @RequireAlertTriageRole()
  @ApiOperation({
    summary: 'Get alert details',
    description: 'Retrieve detailed information about a specific alert',
  })
  @ApiParam({
    name: 'alertId',
    type: 'string',
    description: 'UUID of the alert',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        alert_id: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
        priority: { type: 'string' },
        alert_type: { type: 'string' },
        confidence_per: { type: 'number' },
        case_id: { type: 'string', format: 'uuid', nullable: true },
        alert_data: { type: 'object' },
        transaction_data: { type: 'object' },
        network_map: { type: 'object' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async getAlertDetails(@Param('alertId') alertId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return this.triageService.getAlertDetails(alertId, tenantId, userId);
  }

  @Post('create-nalt-alert')
  @RequireInvestigatorOrSupervisorRole()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a NALT alert for manual case creation',
    description: 'Creates an alert with NALT status that can be used to manually create a case',
  })
  @ApiBody({ type: CreateNaltAlertDto })
  @ApiResponse({
    status: 201,
    description: 'NALT alert created successfully',
    schema: {
      type: 'object',
      properties: {
        alert_id: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
        priority: { type: 'string' },
        confidence_per: { type: 'number' },
        created_at: { type: 'string', format: 'date-time' },
        alert_data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'NALT' }
          }
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createNaltAlert(@Body() dto: CreateNaltAlertDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');

    const submitAlertDto: SubmitAlertDto = {
      message: dto.message,
      report: {
        ...dto.report,
        status: 'NALT',
      },
      transaction: dto.transaction,
      networkMap: dto.networkMap,
      confidence_per: 0,
    };

    const alert = await this.triageService.handleNotAlert(submitAlertDto, userId, tenantId, 'REST API');
    return alert;
  }


@Post('ingest')
@RequireAlertTriageRole()
  async processIncomingAlert(@Body() dto: AlertMessageDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    const tenantId = req.user.token.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenantId');
    if (!userId) throw new BadRequestException('Missing userId');
    return await this.triageService.processIncomingAlert(dto, 'REST API', userId , tenantId);
  }
}