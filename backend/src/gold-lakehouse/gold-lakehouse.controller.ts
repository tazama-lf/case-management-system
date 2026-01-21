import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TazamaAuthGuard } from '../auth/tazama-auth.guard';
import { GoldLakehouseService } from './gold-lakehouse.service';
import { RequireInvestigatorOrSupervisorRole } from 'src/auth/auth.decorator';

@ApiTags('Gold Lakehouse')
@Controller('api/v1/lakehouse')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class GoldLakehouseController {
  constructor(private readonly goldLakehouseService: GoldLakehouseService) {}

  @Get('alert-navigator/:alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Alert Navigator data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorData(@Param('alertId') alertId: string, @Query('tenantId') tenantId?: string) {
    const alertIdNum = parseInt(alertId, 10);
    if (isNaN(alertIdNum)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    return this.goldLakehouseService.getAlertNavigatorData(alertIdNum, tenantId || 'DEFAULT');
  }

  @Get('transaction-detail/:transactionId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Transaction Detail data for visualization' })
  @ApiResponse({ status: 200 })
  async getTransactionDetailData(@Param('transactionId') transactionId: string, @Query('tenantId') tenantId?: string) {
    const transactionIdNum = parseInt(transactionId, 10);
    if (isNaN(transactionIdNum)) {
      throw new BadRequestException('Invalid transactionId: must be a number');
    }
    return this.goldLakehouseService.getTransactionDetailData(transactionIdNum, tenantId || 'DEFAULT');
  }

  @Get('alert-navigator-metrics/:alertId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Alert Navigator Metrics data for visualization' })
  @ApiResponse({ status: 200 })
  async getAlertNavigatorMetrics(@Param('alertId') alertId: string, @Query('tenantId') tenantId?: string) {
    const alertIdNum = parseInt(alertId, 10);
    if (isNaN(alertIdNum)) {
      throw new BadRequestException('Invalid alertId: must be a number');
    }
    return this.goldLakehouseService.getAlertNavigatorMetrics(alertIdNum, tenantId || 'DEFAULT');
  }

  // ---------------- CONDITIONS VIEW ----------------

  @Get('conditions/summary')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Conditions summary metrics' })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID - REQUIRED',
    required: true,
    type: String,
    example: '6665bafaeeb430692dafe4bd0efb3faMSISDNfsp011',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter start date - OPTIONAL (YYYY-MM-DD). If omitted, returns all history.',
    required: false,
    type: String,
    example: '2026-01-01',
  })
  @ApiResponse({ status: 200 })
  async getConditionsSummary(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('fromDate') fromDate?: string,
  ) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    return this.goldLakehouseService.getConditionsSummary(accountId, tenantId || 'DEFAULT', fromDate);
  }

  @Get('conditions/active')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Active Conditions for an account within a time range' })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID - REQUIRED',
    required: true,
    type: String,
    example: '6665bafaeeb430692dafe4bd0efb3faMSISDNfsp011',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter start date - OPTIONAL (YYYY-MM-DD). If omitted, returns all history.',
    required: false,
    type: String,
    example: '2026-01-01',
  })
  @ApiResponse({ status: 200 })
  async getActiveConditions(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('fromDate') fromDate?: string,
  ) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    return this.goldLakehouseService.getActiveConditions(accountId, tenantId || 'DEFAULT', fromDate);
  }

  @Get('conditions/expired')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get expired conditions for an account' })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID - REQUIRED',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
  })
  @ApiResponse({ status: 200 })
  async getExpiredConditions(@Query('accountId') accountId: string, @Query('tenantId') tenantId?: string) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    return this.goldLakehouseService.getExpiredConditions(accountId, tenantId || 'DEFAULT');
  }

  @Get('conditions/future')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get future conditions for an account' })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID - REQUIRED',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
  })
  @ApiResponse({ status: 200 })
  async getFutureConditions(@Query('accountId') accountId: string, @Query('tenantId') tenantId?: string) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    return this.goldLakehouseService.getFutureConditions(accountId, tenantId || 'DEFAULT');
  }

  @Get('conditions')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({ summary: 'Get Conditions list (active / expired / future)' })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID - REQUIRED',
    required: true,
    type: String,
    example: '6665bafaeeb430692dafe4bd0efb3faMSISDNfsp011',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiResponse({ status: 200 })
  async getConditionsList(@Query('accountId') accountId: string, @Query('tenantId') tenantId?: string) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    return this.goldLakehouseService.getConditionsList(accountId, tenantId);
  }

  @Get('conditions/evaluated-transactions')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get evaluated transactions for Conditions view',
  })
  @ApiQuery({
    name: 'accountId',
    description: 'Account ID - REQUIRED',
    required: true,
    type: String,
    example: '6665bafaeeb430692dafe4bd0efb3faMSISDNfsp011',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter start date - OPTIONAL (YYYY-MM-DD). If omitted, returns all transactions.',
    required: false,
    type: String,
    example: '2026-01-01',
  })
  @ApiResponse({ status: 200 })
  async getEvaluatedTransactions(
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('fromDate') fromDate?: string,
  ) {
    if (!accountId) {
      throw new BadRequestException('accountId is required');
    }

    return this.goldLakehouseService.getEvaluatedTransactions(accountId, tenantId, fromDate);
  }

  @Get('transaction-history/:entityId')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Transaction History data for a specific entity (account/counterparty)',
    description:
      'Returns historical timeline, cumulative data, volume distribution, and recent transactions for an entity. Shows multiple transactions over time. Optional filters: startDate, endDate, granularity. If no filters provided, returns ALL transaction history.',
  })
  @ApiParam({
    name: 'entityId',
    description: 'Entity ID (account or counterparty identifier from transaction_history table) - REQUIRED',
    required: true,
    type: String,
    example: 'cdtrAcct_9e6fccad1b1b4850a6e90f548207748b',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL (defaults to DEFAULT)',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'startDate',
    description: 'Filter start date - OPTIONAL (YYYY-MM-DD). ',
    required: false,
    type: String,
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'Filter end date - OPTIONAL (YYYY-MM-DD).',
    required: false,
    type: String,
    example: '2026-01-31',
  })
  @ApiQuery({
    name: 'granularity',
    description: 'Aggregation bucket granularity - OPTIONAL (day, week, month, year). ',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
    type: String,
    example: 'day',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transaction history data including timeline with cumulative amounts, volume distribution, recent transactions table, and summary statistics',
    schema: {
      example: {
        summary: {
          totalVolume: 102518.5,
          totalTransactions: 154,
          alertsTriggered: 6,
          alertsPercentage: 3.9,
          investigated: 0,
          investigatedPercentage: 0,
          avgTransactionsPerDay: 5.13,
          durationDays: 30,
        },
        timeline: [
          {
            transactionId: 15,
            date: '2026-01-15',
            amount: 1250.0,
            currency: 'USD',
            type: 'pacs.008.001.10',
            isAlerted: true,
            isInvestigated: false,
          },
        ],
        cumulative: [
          {
            date: '2026-01-01',
            cumulativeAmount: 50000.0,
            cumulativeCount: 40,
          },
        ],
        volumeDistribution: [
          {
            bucketStart: '2026-01-01',
            granularity: 'day',
            transactionCount: 5,
            totalVolume: 5000.0,
          },
        ],
        recentTransactions: [
          {
            transactionId: 15,
            date: '2026-01-15',
            type: 'pacs.008.001.10',
            counterparty: 'Jane Smith',
            amount: 1250.0,
            currency: 'USD',
            status: ['Alert'],
            actions: {
              viewDetailsLink: '/triage/transaction-detail/15',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid entity ID or date format' })
  async getTransactionHistoryData(
    @Param('entityId') entityId: string,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: string,
  ) {
    // Validate entity ID
    if (!entityId || entityId.trim() === '') {
      throw new BadRequestException('Entity ID is required');
    }

    // Validate date format if provided
    if (startDate || endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if ((startDate && !dateRegex.test(startDate)) || (endDate && !dateRegex.test(endDate))) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }

      // Both dates must be provided together
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw new BadRequestException('Both startDate and endDate must be provided together');
      }
    }

    // Validate granularity if provided
    if (granularity) {
      const validGranularities = ['day', 'week', 'month', 'year'];
      if (!validGranularities.includes(granularity)) {
        throw new BadRequestException(`Invalid granularity. Must be one of: ${validGranularities.join(', ')}`);
      }
    }

    return this.goldLakehouseService.getTransactionHistoryData(entityId, tenantId || 'DEFAULT', startDate, endDate, granularity);
  }

  @Get('alert-history/summary')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Alert History Summary',
    description: 'Returns summary metrics for alert history including total alerts, user-opened, investigations, cases raised, and total transaction value. Filter by transaction end-to-end ID and date range.',
  })
  @ApiQuery({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID - OPTIONAL (filter for specific transaction and all its alerts)',
    required: false,
    type: String,
    example: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range filter - OPTIONAL (default: all)',
    required: false,
    enum: ['30days', '90days', '6months', '1year', 'all'],
    type: String,
    example: '30days',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert history summary metrics',
    schema: {
      example: {
        totalAlerts: 179,
        casesOpened: 48,
        investigations: 90,
        sarFilings: 4,
        totalValue: 2957437.00,
      },
    },
  })
  async getAlertHistorySummary(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
  ) {
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException(`Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all`);
    }
    return this.goldLakehouseService.getAlertHistorySummary(endToEndId, tenantId, dateRange || 'all');
  }

  @Get('alert-history/timeline')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Alert History Timeline',
    description: 'Returns time-series data for alert history including alert counts, case counts, investigation counts, and total values grouped by date granularity. Filter by transaction end-to-end ID and date range.',
  })
  @ApiQuery({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID - OPTIONAL (filter for specific transaction and all its alerts)',
    required: false,
    type: String,
    example: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range filter - OPTIONAL (default: all)',
    required: false,
    enum: ['30days', '90days', '6months', '1year', 'all'],
    type: String,
    example: '30days',
  })
  @ApiQuery({
    name: 'granularity',
    description: 'Aggregation bucket granularity - OPTIONAL (day, week, month, year)',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
    type: String,
    example: 'day',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert history timeline data with separate alert count and alert value arrays',
    schema: {
      example: {
        alertCountOverTime: [
          {
            date: '2026-01-20T00:00:00.000Z',
            alerts: 25,
            cases: 5,
            investigations: 10,
          },
          {
            date: '2026-01-19T00:00:00.000Z',
            alerts: 30,
            cases: 8,
            investigations: 15,
          },
        ],
        alertValueOverTime: [
          {
            date: '2026-01-20T00:00:00.000Z',
            totalValue: 125000.50,
          },
          {
            date: '2026-01-19T00:00:00.000Z',
            totalValue: 89500.75,
          },
        ],
      },
    },
  })
  async getAlertHistoryTimeline(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('granularity') granularity: string = 'day',
  ) {
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException(`Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all`);
    }
    if (granularity) {
      const validGranularities = ['day', 'week', 'month', 'year'];
      if (!validGranularities.includes(granularity)) {
        throw new BadRequestException(`Invalid granularity. Must be one of: ${validGranularities.join(', ')}`);
      }
    }
    return this.goldLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange || 'all', granularity);
  }

  @Get('alert-history/alerts')
  @RequireInvestigatorOrSupervisorRole()
  @ApiOperation({
    summary: 'Get Alert History Alerts',
    description: 'Returns paginated list of alerts with customer names, account IDs, transaction details, and navigation actions. Filter by transaction end-to-end ID and date range.',
  })
  @ApiQuery({
    name: 'endToEndId',
    description: 'Transaction End-to-End ID - OPTIONAL (filter for specific transaction and all its alerts)',
    required: false,
    type: String,
    example: '9dbb43f2-ebf9-46ad-abe1-c3e31e2b4371',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'Tenant ID - OPTIONAL',
    required: false,
    type: String,
    example: 'DEFAULT',
  })
  @ApiQuery({
    name: 'dateRange',
    description: 'Date range filter - OPTIONAL (default: all)',
    required: false,
    enum: ['30days', '90days', '6months', '1year', 'all'],
    type: String,
    example: '30days',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number - OPTIONAL (default: 1)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page - OPTIONAL (default: 20)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated alert history list',
    schema: {
      example: {
        alerts: [
          {
            alertId: 444,
            date: '2026-01-20T03:26:47.789892',
            type: 'FRAUD_AND_AML',
            severity: 'BREACH',
            status: 'ALRT',
            caseId: 225,
            outcome: 'Investigating',
            actions: {
              viewAlertNavigator: '/alert-navigator/444',
              viewTransactionDetails: '/transaction-detail/598777d8-ad56-4af4-8f4d-417a870834f2',
            },
          },
        ],
        pagination: {
          total: 21,
          page: 1,
          limit: 20,
          totalPages: 2,
        },
      },
    },
  })
  async getAlertHistoryAlerts(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException(`Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all`);
    }
    return this.goldLakehouseService.getAlertHistoryAlerts(
      endToEndId,
      tenantId,
      dateRange || 'all',
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}

