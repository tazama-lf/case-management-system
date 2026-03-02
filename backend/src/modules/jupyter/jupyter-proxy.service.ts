import { Injectable } from '@nestjs/common';
import { GoldLakehouseService } from '../gold-lakehouse/gold-lakehouse.service';

@Injectable()
export class JupyterProxyService {
  constructor(private readonly goldLakehouseService: GoldLakehouseService) {}

  async getCounterpartyNetworkData(accountId: string, tenantId: string, timeRange: string) {
    return await this.goldLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange);
  }

  async getCounterpartyNodeFullData(counterpartyId: string, tenantId: string, granularity: 'day' | 'month' | 'year' = 'month') {
    return await this.goldLakehouseService.getCounterpartyNodeFullData(counterpartyId, tenantId, granularity);
  }

  async getAlertHistorySummary(endToEndId?: string, tenantId?: string, dateRange?: string) {
    return await this.goldLakehouseService.getAlertHistorySummary(endToEndId, tenantId, dateRange ?? 'all');
  }

  async getTransactionHistoryData(entityId: string, tenantId?: string, startDate?: string, endDate?: string, granularity?: string) {
    return await this.goldLakehouseService.getTransactionHistoryData(entityId, tenantId ?? 'DEFAULT', startDate, endDate, granularity);
  }

  async getAlertHistoryTimeline(endToEndId?: string, tenantId?: string, dateRange?: string, granularity = 'day') {
    return await this.goldLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange ?? 'all', granularity);
  }

  async getAlertHistoryAlerts(endToEndId?: string, tenantId?: string, dateRange?: string, page = 1, limit = 20) {
    return await this.goldLakehouseService.getAlertHistoryAlerts(endToEndId, tenantId, dateRange ?? 'all', page, limit);
  }

  async getTransactionNetworkData(accountId: string, tenantId?: string, timeRange?: string) {
    return await this.goldLakehouseService.getTransactionNetworkData(accountId, tenantId ?? 'DEFAULT', timeRange ?? '30d');
  }

  async getAccountNetworkData(accountId: string, tenantId?: string, granularity: 'day' | 'month' | 'year' = 'month') {
    return await this.goldLakehouseService.getAccountNodeFullData(accountId, tenantId ?? 'DEFAULT', granularity);
  }

  async getBenfordByAccount(accountId: string, tenantId: string, from: string, to: string) {
    return await this.goldLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, from, to);
  }
}
