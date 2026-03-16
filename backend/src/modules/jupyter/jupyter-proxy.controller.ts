import { Controller, Get, Param, Query, BadRequestException, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JupyterProxyService } from './jupyter-proxy.service';
import { CounterpartyNetworkResponseDto, TransactionNetworkResponseDto } from '../gold-lakehouse/dto/network-analysis.dto';
import { Alerts, Edge, Node } from '../gold-lakehouse/types/gold-lakehouse.types';
import { AccountNodeFullDataResponse, CounterpartyNodeFullDataResponse } from '../gold-lakehouse/types/gold-lakehouse-responses.types';

@Controller('api/v1/jupyter/proxy')
@ApiTags('Jupyter Proxy')
export class JupyterProxyController {
  constructor(private readonly proxyService: JupyterProxyService) { }

  private validateSecret(headers: Record<string, any>): void {
    const required = process.env.JUPYTER_SHARED_SECRET;
    if (!required) return; // no secret configured -> allow (dev)
    const header = headers['x-jupyter-secret'] ?? headers['X-Jupyter-Secret'] ?? headers['x-jupyter-secret'.toLowerCase()];
    if (!header || header !== required) {
      throw new BadRequestException('Invalid jupyter secret');
    }
  }

  @Get('network-analysis/counterparty/:accountId')
  @ApiOperation({ summary: 'Proxy: Get Counterparty Network Analysis' })
  @ApiQuery({ name: 'timeRange', required: false, example: '30d' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'DEFAULT' })
  async getCounterpartyNetwork(
    @Param('accountId') accountId: string,
    @Query('timeRange') timeRange?: string,
    @Query('tenantId') tenantId?: string,
    @Headers() headers?: Record<string, any>,
  ): Promise<CounterpartyNetworkResponseDto> {
    this.validateSecret(headers ?? {});
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return await this.proxyService.getCounterpartyNetworkData(accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  @Get('network-analysis/counterparty-node/:counterpartyId')
  @ApiOperation({ summary: 'Proxy: Get Counterparty Node Network Analysis with Full Details' })
  @ApiQuery({ name: 'granularity', required: false, example: 'month' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'DEFAULT' })
  async getCounterpartyNodeNetwork(
    @Param('counterpartyId') counterpartyId: string,
    @Query('granularity') granularity?: string,
    @Query('tenantId') tenantId?: string,
    @Headers() headers?: Record<string, any>,
  ): Promise<CounterpartyNodeFullDataResponse> {
    this.validateSecret(headers ?? {});
    if (!counterpartyId || counterpartyId.trim() === '') {
      throw new BadRequestException('counterpartyId is required');
    }
    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }
    return await this.proxyService.getCounterpartyNodeFullData(
      counterpartyId,
      tenantId ?? 'DEFAULT',
      granularity as 'day' | 'month' | 'year',
    );
  }

  @Get('alert-history/summary')
  @ApiOperation({ summary: 'Proxy: Get Alert History Summary' })
  @ApiQuery({ name: 'endToEndId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'dateRange', required: false, example: '30days' })
  async getAlertHistorySummary(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Headers() headers?: Record<string, any>,
  ): Promise<{
    totalAlerts: number;
    casesOpened: number;
    investigations: number;
    sarFilings: number;
    totalValue: number;
  }> {
    this.validateSecret(headers ?? {});
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return await this.proxyService.getAlertHistorySummary(endToEndId, tenantId, dateRange ?? 'all');
  }

  @Get('alert-history/timeline')
  @ApiOperation({ summary: 'Proxy: Get Alert History Timeline' })
  @ApiQuery({ name: 'endToEndId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'dateRange', required: false })
  @ApiQuery({ name: 'granularity', required: false })
  async getAlertHistoryTimeline(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('granularity') granularity = 'day',
    @Headers() headers?: Record<string, any>,
  ): Promise<unknown> {
    this.validateSecret(headers ?? {});
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    if (granularity && !['day', 'week', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, week, month, year');
    }
    return await this.proxyService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange ?? 'all', granularity);
  }

  @Get('alert-history/alerts')
  @ApiOperation({ summary: 'Proxy: Get Alert History Alerts' })
  @ApiQuery({ name: 'endToEndId', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'dateRange', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAlertHistoryAlerts(
    @Query('endToEndId') endToEndId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Headers() headers?: Record<string, any>,
  ): Promise<{
    alerts: Alerts[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    this.validateSecret(headers ?? {});
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return await this.proxyService.getAlertHistoryAlerts(endToEndId, tenantId, dateRange ?? 'all', page ?? 1, limit ?? 20);
  }

  @Get('transaction-history/:entityId')
  @ApiOperation({ summary: 'Proxy: Get Transaction History' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'granularity', required: false })
  async getTransactionHistory(
    @Param('entityId') entityId: string,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: string,
    @Headers() headers?: Record<string, any>,
  ): Promise<unknown> {
    this.validateSecret(headers ?? {});
    if (!entityId || entityId.trim() === '') {
      throw new BadRequestException('entityId is required');
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
    return await this.proxyService.getTransactionHistoryData(entityId, tenantId, startDate, endDate, granularity);
  }

  @Get('network-analysis/transaction/:accountId')
  @ApiOperation({ summary: 'Proxy: Get Transaction Network Analysis' })
  @ApiQuery({ name: 'timeRange', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async getTransactionNetwork(
    @Param('accountId') accountId: string,
    @Query('timeRange') timeRange?: string,
    @Query('tenantId') tenantId?: string,
    @Headers() headers?: Record<string, any>,
  ): Promise<TransactionNetworkResponseDto> {
    this.validateSecret(headers ?? {});
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return await this.proxyService.getTransactionNetworkData(accountId, tenantId, timeRange);
  }

  @Get('network-analysis/account/:accountId')
  @ApiOperation({ summary: 'Proxy: Get Account Network Analysis' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'granularity', required: false })
  async getAccountNetwork(
    @Param('accountId') accountId: string,
    @Query('tenantId') tenantId?: string,
    @Query('granularity') granularity: 'day' | 'month' | 'year' = 'month',
    @Headers() headers?: Record<string, any>,
  ): Promise<AccountNodeFullDataResponse> {
    this.validateSecret(headers ?? {});
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    if (!['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }
    return await this.proxyService.getAccountNetworkData(accountId, tenantId, granularity);
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
    @Headers() headers?: Record<string, any>,
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
    this.validateSecret(headers ?? {});
    if (!tenantId || !from || !to) {
      throw new BadRequestException('tenantId, from and to are required');
    }
    return await this.proxyService.getBenfordByAccount(accountId, tenantId, from, to);
  }
}
