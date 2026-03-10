import { Injectable } from '@nestjs/common';
import { GoldLakehouseService } from '../gold-lakehouse/gold-lakehouse.service';

@Injectable()
export class JupyterProxyService {
  constructor(private readonly goldLakehouseService: GoldLakehouseService) { }

  async getCounterpartyNetworkData(accountId: string, tenantId: string, timeRange: string) {
    return this.goldLakehouseService.getCounterpartyNetworkData(accountId, tenantId, timeRange);
  }

  async getCounterpartyNodeFullData(counterpartyId: string, tenantId: string, granularity: 'day' | 'month' | 'year' = 'month') {
    return this.goldLakehouseService.getCounterpartyNodeFullData(counterpartyId, tenantId, granularity);
  }

  async getAlertHistorySummary(endToEndId?: string, tenantId?: string, dateRange?: string) {
    return this.goldLakehouseService.getAlertHistorySummary(endToEndId, tenantId, dateRange || 'all');
  }

  async getTransactionHistoryData(entityId: string, tenantId?: string, startDate?: string, endDate?: string, granularity?: string) {
    return this.goldLakehouseService.getTransactionHistoryData(entityId, tenantId || 'DEFAULT', startDate, endDate, granularity);
  }

  async getAlertHistoryTimeline(endToEndId?: string, tenantId?: string, dateRange?: string, granularity: string = 'day') {
    return this.goldLakehouseService.getAlertHistoryTimeline(endToEndId, tenantId, dateRange || 'all', granularity);
  }

  async getAlertHistoryAlerts(endToEndId?: string, tenantId?: string, dateRange?: string, page: number = 1, limit: number = 20) {
    return this.goldLakehouseService.getAlertHistoryAlerts(endToEndId, tenantId, dateRange || 'all', page, limit);
  }

  async getTransactionNetworkData(accountId: string, tenantId?: string, timeRange?: string) {
    return this.goldLakehouseService.getTransactionNetworkData(accountId, tenantId || 'DEFAULT', timeRange || '30d');
  }

  async getAccountNetworkData(accountId: string, tenantId?: string, granularity: 'day' | 'month' | 'year' = 'month') {
    return this.goldLakehouseService.getAccountNodeFullData(accountId, tenantId || 'DEFAULT', granularity);
  }

  async getBenfordByAccount(accountId: string, tenantId: string, from: string, to: string) {
    return this.goldLakehouseService.getBenfordAnalysisByAccount(accountId, tenantId, from, to);
  }

  // ================ CONDITIONS PROXY METHODS ================

  async getConditionsContextByTransaction(transactionId: number, tenantId: string = 'DEFAULT', asOfDate?: string) {
    return this.goldLakehouseService.getConditionsContextByTransaction(transactionId, tenantId, asOfDate);
  }

  async getConditionsSummary(accountId: string, tenantId: string = 'DEFAULT', asOfDate?: string) {
    return this.goldLakehouseService.getConditionsSummaryByAccount(accountId, tenantId, undefined, asOfDate);
  }

  async getConditionsDetails(accountId: string, tenantId: string = 'DEFAULT', asOfDate?: string, showInactive?: boolean) {
    return this.goldLakehouseService.getConditionsListByAccount(accountId, tenantId, asOfDate, showInactive || false);
  }

  async getConditionsEvaluatedTransactions(accountId: string, tenantId: string = 'DEFAULT', fromDate?: string) {
    return this.goldLakehouseService.getEvaluatedTransactionsByAccount(accountId, tenantId, fromDate);
  }
}
