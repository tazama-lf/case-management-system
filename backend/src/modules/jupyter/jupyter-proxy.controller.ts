import { Controller, Get, Param, Query, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JupyterProxyService } from './jupyter-proxy.service';
import { TazamaAuthGuard } from '../../guards/tazama-auth.guard';
import { CounterpartyNetworkResponseDto, TransactionNetworkResponseDto } from '../gold-lakehouse/dto/network-analysis.dto';
import {
  AccountNodeFullDataResponse,
  ConditionsContextByTransactionResponse,
  CounterpartyNodeFullDataResponse,
  EvaluatedTransactionsResponse,
} from '../gold-lakehouse/types/gold-lakehouse-responses.types';
import { AlertHistoryAlertsResponse } from '../gold-lakehouse/types/IAlertHistory.types';
import { TransactionHistoryResponse } from '../gold-lakehouse/types/transaction-history-response.types';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';

@Controller('api/v1/jupyter/proxy')
@ApiTags('Jupyter Proxy')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class JupyterProxyController {
  constructor(private readonly proxyService: JupyterProxyService) {}

  private getUserId(req: AuthenticatedRequest): string {
    const { userId } = req.user;
    if (!userId) {
      throw new BadRequestException('User ID not found in authenticated request');
    }
    return userId;
  }

  @Get('network-analysis/counterparty/:accountId')
  @ApiOperation({ summary: 'Proxy: Get Counterparty Network Analysis' })
  @ApiQuery({ name: 'timeRange', required: false, example: '30d' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'DEFAULT' })
  async getCounterpartyNetwork(
    @Req() req: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Query('timeRange') timeRange?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<CounterpartyNetworkResponseDto> {
    const userId = this.getUserId(req);
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return await this.proxyService.getCounterpartyNetworkData(userId, accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  @Get('network-analysis/counterparty-node/:counterpartyId')
  @ApiOperation({ summary: 'Proxy: Get Counterparty Node Network Analysis with Full Details' })
  @ApiQuery({ name: 'granularity', required: false, example: 'month' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'DEFAULT' })
  async getCounterpartyNodeNetwork(
    @Req() req: AuthenticatedRequest,
    @Param('counterpartyId') counterpartyId: string,
    @Query('granularity') granularity?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<CounterpartyNodeFullDataResponse> {
    const userId = this.getUserId(req);
    if (!counterpartyId || counterpartyId.trim() === '') {
      throw new BadRequestException('counterpartyId is required');
    }
    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }
    return await this.proxyService.getCounterpartyNodeFullData(
      userId,
      counterpartyId,
      tenantId ?? 'DEFAULT',
      granularity as 'day' | 'month' | 'year',
    );
  }

  @Get('alert-history/summary')
  @ApiOperation({ summary: 'Proxy: Get Alert History Summary' })
  @ApiQuery({ name: 'endToEndId', required: false })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'dateRange', required: false, example: '30days' })
  async getAlertHistorySummary(
    @Req() req: AuthenticatedRequest,
    @Query('tenantId') tenantId: string,
    @Query('endToEndId') endToEndId?: string,
    @Query('dateRange') dateRange?: string,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    const userId = this.getUserId(req);
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return await this.proxyService.getAlertHistorySummary(userId, endToEndId, tenantId, dateRange ?? 'all');
  }

  @Get('alert-history/timeline')
  @ApiOperation({ summary: 'Proxy: Get Alert History Timeline' })
  @ApiQuery({ name: 'endToEndId', required: false })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'dateRange', required: false })
  @ApiQuery({ name: 'granularity', required: false })
  async getAlertHistoryTimeline(
    @Req() req: AuthenticatedRequest,
    @Query('tenantId') tenantId: string,
    @Query('endToEndId') endToEndId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('granularity') granularity = 'day',
  ): Promise<unknown> {
    const userId = this.getUserId(req);
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    if (granularity && !['day', 'week', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, week, month, year');
    }
    return await this.proxyService.getAlertHistoryTimeline(userId, endToEndId, tenantId, dateRange ?? 'all', granularity);
  }

  @Get('alert-history/alerts')
  @ApiOperation({ summary: 'Proxy: Get Alert History Alerts' })
  @ApiQuery({ name: 'endToEndId', required: false })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'dateRange', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAlertHistoryAlerts(
    @Req() req: AuthenticatedRequest,
    @Query('tenantId') tenantId: string,
    @Query('endToEndId') endToEndId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<AlertHistoryAlertsResponse> {
    const userId = this.getUserId(req);
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return await this.proxyService.getAlertHistoryAlerts(userId, endToEndId, tenantId, dateRange ?? 'all', page ?? 1, limit ?? 20);
  }

  @Get('transaction-history/:accountId')
  @ApiOperation({ summary: 'Proxy: Get Transaction History' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'granularity', required: false })
  async getTransactionHistory(
    @Req() req: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: string,
  ): Promise<TransactionHistoryResponse> {
    const userId = this.getUserId(req);
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    // reuse same validation as gold-lakehouse
    if (startDate ?? endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/v;
      if ((startDate && !dateRegex.test(startDate)) ?? (endDate && !dateRegex.test(endDate))) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }
      if ((startDate && !endDate) ?? (!startDate && endDate)) {
        throw new BadRequestException('Both startDate and endDate must be provided together');
      }
    }
    if (granularity && !['day', 'week', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, week, month, year');
    }
    return await this.proxyService.getTransactionHistoryData(userId, accountId, tenantId, startDate, endDate, granularity);
  }

  @Get('lake/analytics/benford/account/:accountId')
  @ApiOperation({ summary: 'Proxy: Benford analysis by account' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async benfordByAccount(
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    expected: Record<number, number>;
    actual: Record<number, number>;
    sampleSize: number;
    meta: {
      accountId: string;
      tenantId: string;
      fromDate: string;
      toDate: string;
    };
  }> {
    const userId = this.getUserId(req);
    if (!tenantId || !from || !to) {
      throw new BadRequestException('tenantId, from and to are required');
    }
    return await this.proxyService.getBenfordByAccount(userId, accountId, tenantId, from, to);
  }

  @Get('network-analysis/transaction/:accountId')
  @ApiOperation({ summary: 'Proxy: Get Transaction Network Analysis' })
  @ApiQuery({ name: 'timeRange', required: false })
  @ApiQuery({ name: 'tenantId', required: true })
  async getTransactionNetwork(
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('timeRange') timeRange: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<TransactionNetworkResponseDto> {
    const userId = this.getUserId(req);
    return await this.proxyService.getTransactionNetworkData(userId, accountId, tenantId, timeRange);
  }

  @Get('network-analysis/entity/:entityId')
  @ApiOperation({ summary: 'Proxy: Get Entity Network Analysis' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'granularity', required: false })
  async getEntityNetwork(
    @Req() req: AuthenticatedRequest,
    @Param('entityId') entityId: string,
    @Query('tenantId') tenantId?: string,
    @Query('granularity') granularity: 'day' | 'month' | 'year' = 'month',
  ): Promise<AccountNodeFullDataResponse> {
    const userId = this.getUserId(req);
    if (!entityId || entityId.trim() === '') {
      throw new BadRequestException('entityId is required');
    }
    if (!['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }
    return await this.proxyService.getAccountNetworkData(userId, entityId, tenantId, granularity);
  }

  @Get('conditions/by-transaction/:transactionId')
  @ApiOperation({ summary: 'Proxy: Get transaction context with conditions for both parties' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getConditionsContextByTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('transactionId') transactionId: string,
    @Query('tenantId') tenantId: string,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<ConditionsContextByTransactionResponse> {
    if (!transactionId || transactionId.trim() === '') {
      throw new BadRequestException('transactionId is required');
    }
    const userId = this.getUserId(req);
    return await this.proxyService.getConditionsContextByTransaction(userId, transactionId, tenantId, asOfDate);
  }

  @Get('conditions/summary')
  @ApiOperation({ summary: 'Proxy: Get conditions summary with counts by Account ID' })
  @ApiQuery({ name: 'accountId', required: true })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getConditionsSummary(
    @Req() req: AuthenticatedRequest,
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<{
    accountId: string;
    accountScheme: any;
    fspId: any;
    totalConditions: any;
    activeConditions: any;
    expiredConditions: any;
    futureConditions: any;
    conditions: any;
    metadata: {
      asOfDate: string;
      queryTimestamp: string;
    };
  }> {
    const userId = this.getUserId(req);
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    return await this.proxyService.getConditionsSummary(userId, accountId, tenantId, asOfDate);
  }

  @Get('conditions/details')
  @ApiOperation({ summary: 'Proxy: Get complete condition records with full details by Account ID' })
  @ApiQuery({ name: 'accountId', required: true })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'asOfDate', required: false })
  @ApiQuery({ name: 'showInactive', required: false })
  async getConditionsDetails(
    @Req() req: AuthenticatedRequest,
    @Query('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('asOfDate') asOfDate?: string,
    @Query('showInactive') showInactive?: boolean,
  ): Promise<{
    accountId: string;
    totalConditions: any;
    conditions: any;
    metadata: {
      activeCount: any;
      expiredCount: any;
      futureCount: any;
      asOfDate: string;
      showInactive: boolean;
      queryTimestamp: string;
    };
  }> {
    const userId = this.getUserId(req);
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    return await this.proxyService.getConditionsDetails(userId, accountId, tenantId, asOfDate, showInactive);
  }

  @Get('conditions/evaluated-transactions/:accountId')
  @ApiOperation({ summary: 'Proxy: Get evaluated transactions for a condition/account' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'fromDate', required: false })
  async getConditionsEvaluatedTransactions(
    @Req() req: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId: string,
    @Query('fromDate') fromDate?: string,
  ): Promise<EvaluatedTransactionsResponse> {
    const userId = this.getUserId(req);
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    return await this.proxyService.getConditionsEvaluatedTransactions(userId, accountId, tenantId, fromDate);
  }
}
