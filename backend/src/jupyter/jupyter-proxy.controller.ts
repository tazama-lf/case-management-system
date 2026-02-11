import { Controller, Get, Param, Query, BadRequestException, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JupyterProxyService } from './jupyter-proxy.service';

@Controller('api/v1/jupyter/proxy')
@ApiTags('Jupyter Proxy')
export class JupyterProxyController {
  constructor(private readonly proxyService: JupyterProxyService) {}

  private validateSecret(headers: Record<string, any>) {
    const required = process.env.JUPYTER_SHARED_SECRET;
    if (!required) return; // no secret configured -> allow (dev)
    const header = headers['x-jupyter-secret'] || headers['X-Jupyter-Secret'] || headers['x-jupyter-secret'.toLowerCase()];
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
  ) {
    this.validateSecret(headers || {});
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return this.proxyService.getCounterpartyNetworkData(accountId, tenantId || 'DEFAULT', timeRange || '30d');
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
  ) {
    this.validateSecret(headers || {});
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return this.proxyService.getAlertHistorySummary(endToEndId, tenantId, dateRange || 'all');
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
    @Query('granularity') granularity: string = 'day',
    @Headers() headers?: Record<string, any>,
  ) {
    this.validateSecret(headers || {});
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    if (granularity && !['day', 'week', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, week, month, year');
    }
    return this.proxyService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange || 'all', granularity);
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
  ) {
    this.validateSecret(headers || {});
    if (dateRange && !['30days', '90days', '6months', '1year', 'all'].includes(dateRange)) {
      throw new BadRequestException('Invalid dateRange. Must be one of: 30days, 90days, 6months, 1year, all');
    }
    return this.proxyService.getAlertHistoryAlerts(endToEndId, tenantId, dateRange || 'all', page ? Number(page) : 1, limit ? Number(limit) : 20);
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
  ) {
    this.validateSecret(headers || {});
    if (!entityId || entityId.trim() === '') {
      throw new BadRequestException('entityId is required');
    }
    // reuse same validation as gold-lakehouse
    if (startDate || endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if ((startDate && !dateRegex.test(startDate)) || (endDate && !dateRegex.test(endDate))) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw new BadRequestException('Both startDate and endDate must be provided together');
      }
    }
    if (granularity && !['day', 'week', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, week, month, year');
    }
    return this.proxyService.getTransactionHistoryData(entityId, tenantId, startDate, endDate, granularity);
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
  ) {
    this.validateSecret(headers || {});
    if (timeRange && !['7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      throw new BadRequestException('Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y, all');
    }
    return this.proxyService.getTransactionNetworkData(accountId, tenantId, timeRange);
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
  ) {
    this.validateSecret(headers || {});
    if (!accountId || accountId.trim() === '') {
      throw new BadRequestException('accountId is required');
    }
    if (granularity && !['day', 'month', 'year'].includes(granularity)) {
      throw new BadRequestException('Invalid granularity. Must be one of: day, month, year');
    }
    return this.proxyService.getAccountNetworkData(accountId, tenantId, granularity);
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
  ) {
    this.validateSecret(headers || {});
    if (!tenantId || !from || !to) {
      throw new BadRequestException('tenantId, from and to are required');
    }
    return this.proxyService.getBenfordByAccount(accountId, tenantId, from, to);
  }
}
